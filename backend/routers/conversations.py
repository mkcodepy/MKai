import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from database import conversations, messages, assistants, knowledge_chunks, serialize_doc
from models import ConversationCreate, InboundMessage, HumanMessage, StatusUpdate
from ai_core import generate_reply

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def _now():
    return datetime.now(timezone.utc).isoformat()


async def _get_history(conversation_id: str):
    msgs = await messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    return msgs


async def _add_message(conversation_id: str, role: str, text: str, handoff: bool = False):
    doc = {"id": str(uuid.uuid4()), "conversation_id": conversation_id, "role": role,
           "text": text, "handoff": handoff, "created_at": _now()}
    await messages.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


async def _run_ai_reply(conv: dict, user_text: str):
    """Gera e persiste a resposta da IA se ela não estiver pausada."""
    if conv.get("ai_paused") or conv.get("status") == "human":
        return None
    cfg = await assistants.find_one({"id": conv["assistant_id"]}, {"_id": 0})
    if not cfg:
        return None
    chunks = [c["text"] for c in await knowledge_chunks.find(
        {"assistant_id": conv["assistant_id"]}, {"_id": 0, "text": 1}).to_list(2000)]
    history = await _get_history(conv["id"])
    try:
        clean, handoff = await generate_reply(cfg, chunks, history, user_text, conv["id"])
    except Exception as e:
        clean, handoff = (f"[Erro ao gerar resposta da IA: {e}]", False)
    msg = await _add_message(conv["id"], "assistant", clean, handoff)
    update = {"last_message": clean, "last_message_at": _now()}
    if handoff:
        update["status"] = "human"
        update["ai_paused"] = True
        update["handoff"] = True
    await conversations.update_one({"id": conv["id"]}, {"$set": update})
    return msg


@router.get("")
async def list_conversations(status: str = None):
    q = {"status": status} if status else {}
    docs = await conversations.find(q, {"_id": 0}).sort("last_message_at", -1).to_list(500)
    for d in docs:
        a = await assistants.find_one({"id": d.get("assistant_id")}, {"_id": 0, "name": 1})
        d["assistant_name"] = a["name"] if a else "—"
    return docs


@router.post("")
async def create_conversation(payload: ConversationCreate):
    if not await assistants.find_one({"id": payload.assistant_id}):
        raise HTTPException(404, "Assistente não encontrado")
    doc = {
        "id": str(uuid.uuid4()), "channel": payload.channel, "contact_name": payload.contact_name,
        "contact_phone": payload.contact_phone, "assistant_id": payload.assistant_id,
        "status": "bot", "ai_paused": False, "handoff": False, "unread": 0,
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
    return conv


@router.post("/{conversation_id}/inbound")
async def inbound_message(conversation_id: str, payload: InboundMessage):
    """Mensagem recebida do cliente (simulador ou WhatsApp). Dispara IA se ativa."""
    conv = await conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    cust = await _add_message(conversation_id, "customer", payload.text)
    await conversations.update_one({"id": conversation_id},
                                   {"$set": {"last_message": payload.text, "last_message_at": _now()}})
    ai_msg = await _run_ai_reply(conv, payload.text)
    return {"customer_message": cust, "assistant_message": ai_msg}


@router.post("/{conversation_id}/human")
async def human_message(conversation_id: str, payload: HumanMessage):
    """Mensagem enviada pelo atendente humano."""
    conv = await conversations.find_one({"id": conversation_id}, {"_id": 0})
    if not conv:
        raise HTTPException(404, "Conversa não encontrada")
    msg = await _add_message(conversation_id, "human", payload.text)
    await conversations.update_one({"id": conversation_id},
                                   {"$set": {"last_message": payload.text, "last_message_at": _now()}})
    return msg


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
    if payload.ai_paused is not None:
        updates["ai_paused"] = payload.ai_paused
        if payload.ai_paused is False and payload.status is None:
            updates["status"] = "bot"
            updates["handoff"] = False
    if not updates:
        raise HTTPException(400, "Nada para atualizar")
    res = await conversations.update_one({"id": conversation_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(404, "Conversa não encontrada")
    return await conversations.find_one({"id": conversation_id}, {"_id": 0})


@router.delete("/{conversation_id}")
async def delete_conversation(conversation_id: str):
    await conversations.delete_one({"id": conversation_id})
    await messages.delete_many({"conversation_id": conversation_id})
    return {"ok": True}
