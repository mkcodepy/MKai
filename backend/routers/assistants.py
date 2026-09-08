import uuid
import asyncio
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from database import assistants, knowledge_sources, knowledge_chunks, conversations, messages, serialize_doc
from models import AssistantCreate, AssistantUpdate, GenerateRequest, EvaluateRequest
from ai_core import PROVIDER_MODELS, DEFAULT_MODEL, generate_assistant_config, prepare_context, generate_reply
from templates import list_templates, get_template

router = APIRouter(prefix="/api/assistants", tags=["assistants"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _chunks_for(assistant_id: str):
    return await knowledge_chunks.find({"assistant_id": assistant_id},
                                       {"_id": 0, "text": 1, "source_title": 1, "source_id": 1}).to_list(5000)


# ----- rotas específicas ANTES das parametrizadas -----
@router.get("/templates")
async def templates():
    return list_templates()


@router.get("/templates/{key}")
async def template_detail(key: str):
    t = get_template(key)
    if not t:
        raise HTTPException(404, "Template não encontrado")
    return t


@router.post("/generate")
async def generate(payload: GenerateRequest):
    """Gera uma configuração completa de assistente a partir da descrição do negócio (IA)."""
    if len(payload.description.strip()) < 15:
        raise HTTPException(400, "Descreva o negócio com mais detalhes (mínimo 15 caracteres).")
    try:
        cfg = await generate_assistant_config(payload.description, payload.provider, payload.language)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Falha ao gerar configuração: {e}")
    cfg["provider"] = payload.provider if payload.provider in PROVIDER_MODELS else "openai"
    cfg["model"] = DEFAULT_MODEL[cfg["provider"]]
    cfg["language"] = payload.language
    return cfg


@router.get("")
async def list_assistants():
    docs = await assistants.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    for d in docs:
        d["knowledge_count"] = await knowledge_sources.count_documents({"assistant_id": d["id"]})
        d["conversation_count"] = await conversations.count_documents({"assistant_id": d["id"]})
    return docs


@router.post("")
async def create_assistant(payload: AssistantCreate):
    data = payload.model_dump()
    if data["provider"] not in PROVIDER_MODELS:
        raise HTTPException(400, "Provedor inválido")
    if not data.get("model"):
        data["model"] = DEFAULT_MODEL[data["provider"]]
    data["id"] = str(uuid.uuid4())
    data["created_at"] = _now()
    data["updated_at"] = _now()
    await assistants.insert_one(dict(data))
    return serialize_doc(data)


@router.get("/{assistant_id}")
async def get_assistant(assistant_id: str):
    doc = await assistants.find_one({"id": assistant_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Assistente não encontrado")
    return doc


@router.put("/{assistant_id}")
async def update_assistant(assistant_id: str, payload: AssistantUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Nada para atualizar")
    if "provider" in updates and updates["provider"] not in PROVIDER_MODELS:
        raise HTTPException(400, "Provedor inválido")
    updates["updated_at"] = _now()
    res = await assistants.update_one({"id": assistant_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Assistente não encontrado")
    return await assistants.find_one({"id": assistant_id}, {"_id": 0})


@router.delete("/{assistant_id}")
async def delete_assistant(assistant_id: str):
    await assistants.delete_one({"id": assistant_id})
    await knowledge_sources.delete_many({"assistant_id": assistant_id})
    await knowledge_chunks.delete_many({"assistant_id": assistant_id})
    return {"ok": True}


@router.post("/{assistant_id}/duplicate")
async def duplicate_assistant(assistant_id: str, with_knowledge: bool = True):
    src = await assistants.find_one({"id": assistant_id}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Assistente não encontrado")
    new_id = str(uuid.uuid4())
    doc = dict(src)
    doc.update({"id": new_id, "name": f"{src['name']} (cópia)", "created_at": _now(), "updated_at": _now()})
    await assistants.insert_one(dict(doc))
    if with_knowledge:
        sources = await knowledge_sources.find({"assistant_id": assistant_id}, {"_id": 0}).to_list(1000)
        for s in sources:
            new_sid = str(uuid.uuid4())
            chunks = await knowledge_chunks.find({"source_id": s["id"]}, {"_id": 0}).to_list(5000)
            s2 = dict(s)
            s2.update({"id": new_sid, "assistant_id": new_id, "created_at": _now()})
            await knowledge_sources.insert_one(s2)
            if chunks:
                await knowledge_chunks.insert_many([
                    {**c, "id": str(uuid.uuid4()), "assistant_id": new_id, "source_id": new_sid} for c in chunks])
    doc.pop("_id", None)
    return doc


@router.get("/{assistant_id}/prompt")
async def compiled_prompt(assistant_id: str, sample: str = "Olá, quero saber sobre prazos de entrega."):
    """Mostra o prompt de sistema compilado (com retrieval de exemplo) para transparência e ajuste fino."""
    cfg = await assistants.find_one({"id": assistant_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(404, "Assistente não encontrado")
    chunks = await _chunks_for(assistant_id)
    system, _, sources = prepare_context(cfg, chunks, [], sample)
    return {"prompt": system, "sources": sources, "chars": len(system), "approx_tokens": len(system) // 4}


@router.post("/{assistant_id}/evaluate")
async def evaluate(assistant_id: str, payload: EvaluateRequest):
    """Executa um conjunto de perguntas de teste e retorna respostas + metadados (qualidade)."""
    cfg = await assistants.find_one({"id": assistant_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(404, "Assistente não encontrado")
    qs = [q for q in payload.questions if q.strip()][:10]
    if not qs:
        raise HTTPException(400, "Informe ao menos uma pergunta")
    chunks = await _chunks_for(assistant_id)

    async def run(q):
        try:
            r = await generate_reply(cfg, chunks, [], q, f"eval-{uuid.uuid4().hex[:8]}")
            return {"question": q, "answer": r["text"], "meta": r["meta"], "sources": r["sources"], "latency_ms": r["latency_ms"]}
        except Exception as e:  # noqa: BLE001
            return {"question": q, "error": str(e)}

    results = await asyncio.gather(*[run(q) for q in qs])
    ok = [r for r in results if "error" not in r]
    summary = {
        "total": len(results),
        "errors": len(results) - len(ok),
        "avg_confidence": round(sum(r["meta"]["confidence"] for r in ok) / len(ok), 2) if ok else 0,
        "kb_used_rate": round(sum(1 for r in ok if r["meta"]["kb_used"]) / len(ok) * 100) if ok else 0,
        "handoff_rate": round(sum(1 for r in ok if r["meta"]["handoff"]) / len(ok) * 100) if ok else 0,
        "avg_latency_ms": int(sum(r["latency_ms"] for r in ok) / len(ok)) if ok else 0,
    }
    return {"summary": summary, "results": results}


@router.get("/{assistant_id}/stats")
async def assistant_stats(assistant_id: str):
    total = await conversations.count_documents({"assistant_id": assistant_id})
    handoffs = await conversations.count_documents({"assistant_id": assistant_id, "handoff": True})
    resolved = await conversations.count_documents({"assistant_id": assistant_id, "status": "resolved"})
    ai_msgs = await messages.count_documents({"assistant_id": assistant_id, "role": "assistant"})
    return {"conversations": total, "handoffs": handoffs, "resolved": resolved, "ai_messages": ai_msgs,
            "handoff_rate": round(handoffs / total * 100, 1) if total else 0.0}
