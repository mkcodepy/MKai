import os
import uuid
import asyncio
import logging
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, HTTPException
from database import conversations, messages, assistants, knowledge_chunks
from models import ConversationCreate, InboundMessage, HumanMessage, StatusUpdate, NotesUpdate
from ai_core import generate_reply, summarize_conversation, handoff_briefing, suggest_agent_reply

router = APIRouter(prefix="/api/conversations", tags=["conversations"])
logger = logging.getLogger("atendeai.conversations")

WHATSAPP_SERVICE_URL = os.environ.get("WHATSAPP_SERVICE_URL", "http://localhost:3100")
SUMMARY_EVERY = 10  # mensagens


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _get_history(conversation_id: str):
    return await messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).to_list(1000)


async def _chunks_for(assistant_id: str):
    return await knowledge_chunks.find({"assistant_id": assistant_id},
                                       {"_id": 0, "text": 1, "source_title": 1, "source_id": 1}).to_list(5000)


async def _add_message(conversation_id: str, role: str, text: str, handoff: bool = False, extra: dict = None):
    doc = {"id": str(uuid.uuid4()), "conversation_id": conversation_id, "role": role,
           "text": text, "handoff": handoff, "created_at": _now()}
    if extra:
        doc.update(extra)
    await messages.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


async def _maybe_update_summary(conv: dict, cfg: dict):
    """Memória longa: a cada N mensagens, resume a conversa (em background)."""
    try:
        history = await _get_history(conv["id"])
        if len(history) and len(history) % SUMMARY_EVERY == 0:
            summary = await summarize_conversation(cfg, history, conv.get("summary", ""))
            await conversations.update_one({"id": conv["id"]}, {"$set": {"summary": summary, "summary_at": _now()}})
    except Exception as e:  # noqa: BLE001
        logger.warning("Falha ao resumir conversa %s: %s", conv.get("id"), e)


async def push_to_whatsapp(phone: str, text: str) -> bool:
    """Envia uma mensagem ao cliente via microserviço Baileys (quando ativo)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(f"{WHATSAPP_SERVICE_URL}/send", json={"phone": phone, "text": text})
            return r.status_code < 300
    except Exception as e:  # noqa: BLE001
        logger.warning("whatsapp-service indisponível para envio: %s", e)
        return False


async def _run_ai_reply(conv: dict, user_text: str):
    """Gera e persiste a resposta da IA se ela não estiver pausada. Retorna a mensagem ou None."""
    if conv.get("ai_paused") or conv.get("status") == "human":
        return None
    cfg = await assistants.find_one({"id": conv["assistant_id"]}, {"_id": 0})
    if not cfg:
        return None
    chunks = await _chunks_for(conv["assistant_id"])
    history = await _get_history(conv["id"])
    # a última mensagem do histórico é a do cliente que acabou de chegar -> não duplicar
    prior = history[:-1] if history and history[-1].get("role") == "customer" and history[-1].get("text") == user_text else history
    try:
        r = await generate_reply(cfg, chunks, prior, user_text, conv["id"], conv.get("summary", ""),
                                 channel=conv.get("channel", "chat"), customer_profile=conv.get("customer_profile") or {})
        clean, meta = r["text"], r["meta"]
        extra = {"meta": meta, "sources": r["sources"], "provider": r["provider"], "model": r["model"],
                 "latency_ms": r["latency_ms"], "assistant_id": conv["assistant_id"]}
    except Exception as e:  # noqa: BLE001
        logger.error("Erro IA conv %s: %s", conv["id"], e)
        clean = cfg.get("fallback") or "Desculpe, tive um problema técnico. Vou encaminhar para um atendente humano."
        meta = {"handoff": True, "handoff_reason": "erro técnico", "intent": "erro", "sentiment": "neutro",
                "confidence": 0.0, "kb_used": False, "tags": ["erro"]}
        extra = {"meta": meta, "error": str(e)[:300], "assistant_id": conv["assistant_id"]}
    handoff = bool(meta.get("handoff"))
    msg = await _add_message(conv["id"], "assistant", clean, handoff, extra)
    update = {"last_message": clean, "last_message_at": _now(), "last_intent": meta.get("intent"),
              "sentiment": meta.get("sentiment"), "last_confidence": meta.get("confidence")}
    tags = set(conv.get("ai_tags") or []) | set(meta.get("tags") or [])
    update["ai_tags"] = sorted(tags)[:8]
    if meta.get("profile"):
        update["customer_profile"] = {**(conv.get("customer_profile") or {}), **meta["profile"]}
    if handoff:
        update.update({"status": "human", "ai_paused": True, "handoff": True,
                       "handoff_reason": meta.get("handoff_reason") or "", "handoff_at": _now()})
    await conversations.update_one({"id": conv["id"]}, {"$set": update})
    asyncio.create_task(_maybe_update_summary(conv, cfg))
    return msg


async def _decorate(docs):
    cache = {}
    for d in docs:
        aid = d.get("assistant_id")
        if aid not in cache:
            a = await assistants.find_one({"id": aid}, {"_id": 0, "name": 1, "avatar_color": 1})
            cache[aid] = a
        d["assistant_name"] = cache[aid]["name"] if cache[aid] else "—"
        d["assistant_color"] = cache[aid].get("avatar_color") if cache[aid] else None
    return docs


@router.get("")
async def list_conversations(status: str = None, channel: str = None, assistant_id: str = None):
    q = {}
    if status:
        q["status"] = status
    if channel:
        q["channel"] = channel
    if assistant_id:
        q["assistant_id"] = assistant_id
    docs = await conversations.find(q, {"_id": 0}).sort("last_message_at", -1).to_list(500)
    return await _decorate(docs)


@router.post("")
async def create_conversation(payload: ConversationCreate):
    if not await assistants.find_one({"id": payload.assistant_id}):
        raise HTTPException(404, "Assistente não encontrado")
    doc = {
        "id": str(uuid.uuid4()), "channel": payload.channel, "contact_name": payload.contact_name,
        "contact_phone": payload.contact_phone, "assistant_id": payload.assistant_id,
        "status": "bot", "ai_paused": False, "handoff": False, "unread": 0, "notes": "", "tags": [], "ai_tags": [],
        "summary": "", "sentiment": "neutro", "last_intent": None,
        "last_message": "", "last_message_at": _now(), "created_at": _now(),
    }
    await conversations.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.get("/{conversation_id}")
async def get_conversation(conversation_id: str):
    conv = await conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    conv["messages"] = await _get_history(conversation_id)
    a = await assistants.find_one({"id": conv.get("assistant_id")}, {"_id": 0, "name": 1})
    conv["assistant_name"] = a["name"] if a else "—"
    return conv


@router.post("/{conversation_id}/inbound")
async def inbound_message(conversation_id: str, payload: InboundMessage):
    """Mensagem recebida do cliente (simulador ou WhatsApp). Dispara IA se ativa."""
    conv = await conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    cust = await _add_message(conversation_id, "customer", payload.text)
    await conversations.update_one({"id": conversation_id},
                                   {"$set": {"last_message": payload.text, "last_message_at": _now()},
                                    "$inc": {"unread": 1 if conv.get("ai_paused") else 0}})
    ai_msg = await _run_ai_reply(conv, payload.text)
    return {"customer_message": cust, "assistant_message": ai_msg}


@router.post("/{conversation_id}/human")
async def human_message(conversation_id: str, payload: HumanMessage):
    """Mensagem enviada pelo atendente humano. Em conversas WhatsApp, tenta enviar ao cliente via microserviço."""
    conv = await conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    delivered = None
    if conv.get("channel") == "whatsapp" and conv.get("contact_phone"):
        delivered = await push_to_whatsapp(conv["contact_phone"], payload.text)
    msg = await _add_message(conversation_id, "human", payload.text, extra={"delivered": delivered})
    await conversations.update_one({"id": conversation_id},
                                   {"$set": {"last_message": payload.text, "last_message_at": _now(), "unread": 0}})
    return msg


@router.post("/{conversation_id}/suggest")
async def suggest_reply(conversation_id: str):
    """Copiloto: sugere um rascunho de resposta para o atendente humano."""
    conv = await conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    cfg = await assistants.find_one({"id": conv["assistant_id"]}, {"_id": 0})
    if not cfg:
        raise HTTPException(404, "Assistente não encontrado")
    history = await _get_history(conversation_id)
    try:
        return await suggest_agent_reply(cfg, await _chunks_for(conv["assistant_id"]), history, conv)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Falha ao sugerir resposta: {e}")


@router.post("/{conversation_id}/briefing")
async def briefing(conversation_id: str):
    """Resumo para o atendente assumir (objetivo do cliente, pendências, próximo passo)."""
    conv = await conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    cfg = await assistants.find_one({"id": conv["assistant_id"]}, {"_id": 0}) or {}
    history = await _get_history(conversation_id)
    if not history:
        return {"summary": "Sem mensagens ainda.", "customer_goal": "", "sentiment": "neutro", "open_points": [], "suggested_next_step": ""}
    try:
        b = await handoff_briefing(cfg, history, conv)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Falha ao gerar briefing: {e}")
    await conversations.update_one({"id": conversation_id}, {"$set": {"briefing": b, "briefing_at": _now()}})
    return b


@router.patch("/{conversation_id}/notes")
async def update_notes(conversation_id: str, payload: NotesUpdate):
    upd = {"notes": payload.notes}
    if payload.tags is not None:
        upd["tags"] = [t.strip() for t in payload.tags if t.strip()][:10]
    if payload.assistant_id:
        if not await assistants.find_one({"id": payload.assistant_id}):
            raise HTTPException(404, "Assistente não encontrado")
        upd["assistant_id"] = payload.assistant_id
    res = await conversations.update_one({"id": conversation_id}, {"$set": upd})
    if res.matched_count == 0:
        raise HTTPException(404, "Conversa não encontrada")
    return await conversations.find_one({"id": conversation_id}, {"_id": 0})


@router.patch("/{conversation_id}/status")
async def update_status(conversation_id: str, payload: StatusUpdate):
    updates = {}
    if payload.status is not None:
        updates["status"] = payload.status
        if payload.status == "human":
            updates["ai_paused"] = True
        elif payload.status == "bot":
            updates["ai_paused"] = False
            updates["handoff"] = False
        elif payload.status == "resolved":
            updates["resolved_at"] = _now()
    if payload.ai_paused is not None:
        updates["ai_paused"] = payload.ai_paused
        if payload.ai_paused is False and payload.status is None:
            updates["status"] = "bot"
            updates["handoff"] = False
    if not updates:
        raise HTTPException(400, "Nada para atualizar")
    updates["unread"] = 0
    res = await conversations.update_one({"id": conversation_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Conversa não encontrada")
    return await conversations.find_one({"id": conversation_id}, {"_id": 0})


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str):
    await conversations.delete_one({"id": conversation_id})
    await messages.delete_many({"conversation_id": conversation_id})
    return {"ok": True}
