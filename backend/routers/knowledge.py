import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from database import knowledge_sources, knowledge_chunks, assistants
from models import KnowledgeTextCreate
from ai_core import extract_text_from_bytes, chunk_text, SUPPORTED_EXT

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _index_source(assistant_id: str, source_id: str, text: str):
    chunks = chunk_text(text)
    docs = [
        {"id": str(uuid.uuid4()), "assistant_id": assistant_id, "source_id": source_id,
         "text": c, "order": i}
        for i, c in enumerate(chunks)
    ]
    if docs:
        await knowledge_chunks.insert_many(docs)
    return len(docs)


@router.get("")
async def list_sources(assistant_id: str = None):
    q = {"assistant_id": assistant_id} if assistant_id else {}
    return await knowledge_sources.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/text")
async def create_text_source(payload: KnowledgeTextCreate):
    if not await assistants.find_one({"id": payload.assistant_id}):
        raise HTTPException(404, "Assistente não encontrado")
    source_id = str(uuid.uuid4())
    n = await _index_source(payload.assistant_id, source_id, payload.content)
    doc = {
        "id": source_id, "assistant_id": payload.assistant_id, "type": payload.type,
        "title": payload.title, "content": payload.content, "filename": None,
        "status": "indexed", "chunk_count": n, "created_at": _now(),
    }
    await knowledge_sources.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.post("/upload")
async def upload_source(assistant_id: str = Form(...), file: UploadFile = File(...)):
    if not await assistants.find_one({"id": assistant_id}):
        raise HTTPException(404, "Assistente não encontrado")
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXT:
        raise HTTPException(400, f"Formato {ext} não suportado. Use PDF, DOCX ou TXT.")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(400, "Arquivo muito grande (máx 10MB).")
    try:
        text = extract_text_from_bytes(file.filename, data)
    except Exception as e:
        raise HTTPException(400, f"Falha ao extrair texto: {e}")
    if not text.strip():
        raise HTTPException(400, "Não foi possível extrair texto do arquivo.")
    source_id = str(uuid.uuid4())
    n = await _index_source(assistant_id, source_id, text)
    doc = {
        "id": source_id, "assistant_id": assistant_id, "type": "file",
        "title": file.filename, "content": text[:5000], "filename": file.filename,
        "status": "indexed", "chunk_count": n, "created_at": _now(),
    }
    await knowledge_sources.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@router.delete("/{source_id}")
async def delete_source(source_id: str):
    await knowledge_sources.delete_one({"id": source_id})
    await knowledge_chunks.delete_many({"source_id": source_id})
    return {"ok": True}
