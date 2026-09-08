from datetime import datetime, timezone, timedelta
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
    ai_messages = await messages.count_documents({"role": "assistant"})
    total_sources = await knowledge_sources.count_documents({})
    handoffs = await conversations.count_documents({"handoff": True})
    handoff_rate = round((handoffs / total_conversations * 100), 1) if total_conversations else 0.0
    resolved_by_ai = await conversations.count_documents({"status": "resolved", "handoff": {"$ne": True}})
    ai_resolution_rate = round(resolved_by_ai / resolved * 100, 1) if resolved else 0.0

    # sentimento e intenções
    sentiment = {"positivo": 0, "neutro": 0, "negativo": 0}
    async for row in conversations.aggregate([{"$group": {"_id": "$sentiment", "n": {"$sum": 1}}}]):
        if row["_id"] in sentiment:
            sentiment[row["_id"]] = row["n"]
    intents = []
    async for row in messages.aggregate([
        {"$match": {"role": "assistant", "meta.intent": {"$exists": True, "$nin": [None, "", "erro"]}}},
        {"$group": {"_id": "$meta.intent", "n": {"$sum": 1}}}, {"$sort": {"n": -1}}, {"$limit": 6}]):
        intents.append({"intent": row["_id"], "count": row["n"]})

    # latência e confiança médias
    avg_latency, avg_conf = 0, 0.0
    async for row in messages.aggregate([
        {"$match": {"role": "assistant", "latency_ms": {"$exists": True}}},
        {"$group": {"_id": None, "lat": {"$avg": "$latency_ms"}, "conf": {"$avg": "$meta.confidence"}}}]):
        avg_latency = int(row.get("lat") or 0)
        avg_conf = round(float(row.get("conf") or 0), 2)

    # mensagens por dia (últimos 7 dias)
    today = datetime.now(timezone.utc).date()
    days = [(today - timedelta(days=i)) for i in range(6, -1, -1)]
    per_day = {d.isoformat(): {"customer": 0, "assistant": 0, "human": 0} for d in days}
    since = (today - timedelta(days=6)).isoformat()
    async for row in messages.aggregate([
        {"$match": {"created_at": {"$gte": since}}},
        {"$group": {"_id": {"d": {"$substr": ["$created_at", 0, 10]}, "r": "$role"}, "n": {"$sum": 1}}}]):
        d, r = row["_id"]["d"], row["_id"]["r"]
        if d in per_day and r in per_day[d]:
            per_day[d][r] = row["n"]
    timeline = [{"date": d, **v} for d, v in per_day.items()]

    # por assistente
    per_assistant = []
    async for a in assistants.find({}, {"_id": 0, "id": 1, "name": 1, "avatar_color": 1, "provider": 1, "model": 1}):
        n = await conversations.count_documents({"assistant_id": a["id"]})
        h = await conversations.count_documents({"assistant_id": a["id"], "handoff": True})
        per_assistant.append({**a, "conversations": n, "handoffs": h})

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
        "ai_messages": ai_messages,
        "knowledge_sources": total_sources,
        "handoff_rate": handoff_rate,
        "ai_resolution_rate": ai_resolution_rate,
        "avg_latency_ms": avg_latency,
        "avg_confidence": avg_conf,
        "sentiment": sentiment,
        "intents": intents,
        "timeline": timeline,
        "per_assistant": per_assistant,
        "recent": recent,
    }
