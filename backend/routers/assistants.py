import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from database import assistants, knowledge_sources, knowledge_chunks, conversations, serialize_doc
from models import AssistantCreate, AssistantUpdate
from ai_core import PROVIDER_MODELS, DEFAULT_MODEL

router = APIRouter(prefix="/api/assistants", tags=["assistants"])


def _now():
    return datetime.now(timezone.utc).isoformat()


@router.get("")
async def list_assistants():
    docs = await assistants.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # anexar contagem de fontes de conhecimento
    for d in docs:
        d["knowledge_count"] = await knowledge_sources.count_documents({"assistant_id": d["id"]})
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
