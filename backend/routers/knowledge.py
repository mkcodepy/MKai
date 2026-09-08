import os
import uuid
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from database import knowledge_sources, knowledge_chunks, assistants
from models import KnowledgeTextCreate, KnowledgeUrlCreate, KnowledgeSearch
from ai_core import extract_text_from_bytes, chunk_text, parse_qna_pairs, html_to_text, HybridRetriever, expand_query, SUPPORTED_EXT

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _index_source(assistant_id: str, source_id: str, title: str, text: str, kind: str = "text"):
    chunks = parse_qna_pairs(text) if kind == "qna" else chunk_text(text)
    docs = [
        {"id": str(uuid.uuid4()), "assistant_id": assistant_id, "source_id": source_id,
         "source_title": title, "text": c, "order": i}
        for i, c in enumerate(chunks)
    ]
    if docs:
        await knowledge_chunks.insert_many(docs)
    return len(docs)


async def _save_source(assistant_id: str, kind: str, title: str, content: str, filename=None, url=None):
    source_id = str(uuid.uuid4())
    n = await _index_source(assistant_id, source_id, title, content, kind)
    doc = {
        "id": source_id, "assistant_id": assistant_id, "type": kind, "title": title,
        "content": content[:8000], "full_length": len(content), "filename": filename, "url": url,
        "status": "indexed", "chunk_count": n, "created_at": _now(), "updated_at": _now(),
    }
    await knowledge_sources.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


# ----- rotas específicas antes das parametrizadas -----
@router.get("")
async def list_sources(assistant_id: str = None):
    q = {"assistant_id": assistant_id} if assistant_id else {}
    return await knowledge_sources.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/text")
async def create_text_source(payload: KnowledgeTextCreate):
    if not await assistants.find_one({"id": payload.assistant_id}):
        raise HTTPException(404, "Assistente não encontrado")
    if not payload.content.strip():
        raise HTTPException(400, "Conteúdo vazio")
    kind = "qna" if payload.type == "qna" else "text"
    return await _save_source(payload.assistant_id, kind, payload.title, payload.content)


@router.post("/url")
async def create_url_source(payload: KnowledgeUrlCreate):
    """Importa o conteúdo textual de uma página web pública."""
    if not await assistants.find_one({"id": payload.assistant_id}):
        raise HTTPException(404, "Assistente não encontrado")
    url = payload.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL inválida (use http:// ou https://)")
    try:
        async with httpx.AsyncClient(timeout=20, follow_redirects=True,
                                     headers={"User-Agent": "Mozilla/5.0 AtendeAI-KB/1.0"}) as client:
            r = await client.get(url)
            r.raise_for_status()
            ctype = r.headers.get("content-type", "")
            if "pdf" in ctype:
                text = extract_text_from_bytes("x.pdf", r.content)
            else:
                text = html_to_text(r.text)
    except httpx.HTTPError as e:
        raise HTTPException(400, f"Falha ao acessar a URL: {e}")
    if len(text.strip()) < 50:
        raise HTTPException(400, "A página não retornou texto suficiente para indexar.")
    title = payload.title or url.split("//", 1)[-1][:80]
    return await _save_source(payload.assistant_id, "url", title, text, url=url)


@router.post("/upload")
async def upload_source(assistant_id: str = Form(...), file: UploadFile = File(...)):
    if not await assistants.find_one({"id": assistant_id}):
        raise HTTPException(404, "Assistente não encontrado")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXT:
        raise HTTPException(400, f"Formato {ext} não suportado. Use PDF, DOCX, TXT, MD, CSV ou HTML.")
    data = await file.read()
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(400, "Arquivo muito grande (máx 15MB).")
    try:
        text = extract_text_from_bytes(file.filename, data)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(400, f"Falha ao extrair texto: {e}")
    if not text.strip():
        raise HTTPException(400, "Não foi possível extrair texto do arquivo.")
    return await _save_source(assistant_id, "file", file.filename, text, filename=file.filename)


@router.post("/search")
async def search_knowledge(payload: KnowledgeSearch):
    """Testa o retrieval: mostra quais trechos a IA receberia para uma pergunta."""
    chunks = await knowledge_chunks.find({"assistant_id": payload.assistant_id},
                                         {"_id": 0, "text": 1, "source_title": 1, "source_id": 1}).to_list(5000)
    cfg = await assistants.find_one({"id": payload.assistant_id}, {"_id": 0, "kb_min_score": 1, "kb_full_context_chars": 1}) or {}
    hits = HybridRetriever(chunks).search(expand_query(payload.query, []), top_k=payload.top_k,
                                          min_score=float(cfg.get("kb_min_score", 0.05)))
    total_chars = sum(len(c.get("text", "")) for c in chunks)
    return {"total_chunks": len(chunks), "total_chars": total_chars,
            "full_context": total_chars <= int(cfg.get("kb_full_context_chars", 12000)),
            "results": [{"text": c["text"], "source_title": c.get("source_title"), "source_id": c.get("source_id"), "score": s}
                        for c, s in hits]}


@router.get("/{source_id}")
async def get_source(source_id: str):
    doc = await knowledge_sources.find_one({"id": source_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Fonte não encontrada")
    doc["chunks"] = await knowledge_chunks.find({"source_id": source_id}, {"_id": 0}).sort("order", 1).to_list(5000)
    return doc


@router.put("/{source_id}")
async def update_source(source_id: str, payload: KnowledgeTextCreate):
    """Edita título/conteúdo de uma fonte textual e reindexa."""
    src = await knowledge_sources.find_one({"id": source_id}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Fonte não encontrada")
    kind = "qna" if payload.type == "qna" else ("text" if src["type"] in ("text", "qna") else src["type"])
    await knowledge_chunks.delete_many({"source_id": source_id})
    n = await _index_source(src["assistant_id"], source_id, payload.title, payload.content, kind)
    await knowledge_sources.update_one({"id": source_id}, {"$set": {
        "title": payload.title, "content": payload.content[:8000], "full_length": len(payload.content),
        "type": kind, "chunk_count": n, "updated_at": _now()}})
    return await knowledge_sources.find_one({"id": source_id}, {"_id": 0})


@router.post("/{source_id}/reindex")
async def reindex_source(source_id: str):
    src = await knowledge_sources.find_one({"id": source_id}, {"_id": 0})
    if not src:
        raise HTTPException(404, "Fonte não encontrada")
    content = src.get("content") or ""
    if src.get("url"):
        try:
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                r = await client.get(src["url"])
                r.raise_for_status()
                content = html_to_text(r.text)
        except Exception:  # noqa: BLE001
            pass
    await knowledge_chunks.delete_many({"source_id": source_id})
    n = await _index_source(src["assistant_id"], source_id, src["title"], content, src.get("type", "text"))
    await knowledge_sources.update_one({"id": source_id}, {"$set": {"chunk_count": n, "content": content[:8000], "updated_at": _now()}})
    return await knowledge_sources.find_one({"id": source_id}, {"_id": 0})


@router.delete("/{source_id}")
async def delete_source(source_id: str):
    await knowledge_sources.delete_one({"id": source_id})
    await knowledge_chunks.delete_many({"source_id": source_id})
    return {"ok": True}
