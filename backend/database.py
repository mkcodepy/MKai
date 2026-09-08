"""Conexão MongoDB e helpers de serialização."""
import os
from datetime import datetime, date
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "atendeai")]

# Coleções
assistants = db.assistants
knowledge_sources = db.knowledge_sources
knowledge_chunks = db.knowledge_chunks
conversations = db.conversations
messages = db.messages
channels = db.channels


def serialize_doc(doc):
    """Converte um documento Mongo em algo JSON-serializável.
    Remove _id e converte datetimes para ISO string."""
    if doc is None:
        return None
    out = {}
    for k, v in doc.items():
        if k == "_id":
            continue
        out[k] = _serialize_value(v)
    return out


def _serialize_value(v):
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, dict):
        return {k: _serialize_value(val) for k, val in v.items() if k != "_id"}
    if isinstance(v, list):
        return [_serialize_value(i) for i in v]
    return v


async def create_indexes():
    await knowledge_chunks.create_index("assistant_id")
    await knowledge_sources.create_index("assistant_id")
    await messages.create_index("conversation_id")
    await conversations.create_index("last_message_at")
