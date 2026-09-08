from fastapi import APIRouter
from database import assistants, conversations, messages, knowledge_sources

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def stats():
    total_assistants = await assistants.count_documents({})
    total_conversations = await conversations.count_documents({})
    active = await conversations.count_documents({"status": {"$in": ["bot", "human"]}})
    human = await conversations.count_documents({"status": "human"})
    resolved = await conversations.count_documents({"status": "resolved"})
    total_messages = await messages.count_documents({})
    total_sources = await knowledge_sources.count_documents({})
    handoffs = await conversations.count_documents({"handoff": True})
    handoff_rate = round((handoffs / total_conversations * 100), 1) if total_conversations else 0.0
    recent = await conversations.find({}, {"_id": 0}).sort("last_message_at", -1).to_list(6)
    for r in recent:
        a = await assistants.find_one({"id": r.get("assistant_id")}, {"_id": 0, "name": 1})
        r["assistant_name"] = a["name"] if a else "—"
    return {
        "assistants": total_assistants,
        "conversations": total_conversations,
        "active_conversations": active,
        "human_conversations": human,
        "resolved_conversations": resolved,
        "messages": total_messages,
        "knowledge_sources": total_sources,
        "handoff_rate": handoff_rate,
        "recent": recent,
    }
