"""Modelos Pydantic (payloads de request)."""
from typing import List, Optional
from pydantic import BaseModel, Field


# ------- Assistants -------
class AssistantBase(BaseModel):
    name: str
    description: Optional[str] = ""
    avatar_color: Optional[str] = "#0d9488"
    provider: str = "openai"
    model: str = "gpt-5.4"
    language: str = "Português (Brasil)"
    personality: str = ""
    tone: str = ""
    role_instructions: str = ""
    rules: List[str] = Field(default_factory=list)
    business_objectives: str = ""
    greeting: str = ""
    fallback: str = ""
    handoff_rules: str = ""
    kb_strict: bool = True
    temperature: float = 0.5


class AssistantCreate(AssistantBase):
    pass


class AssistantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_color: Optional[str] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    language: Optional[str] = None
    personality: Optional[str] = None
    tone: Optional[str] = None
    role_instructions: Optional[str] = None
    rules: Optional[List[str]] = None
    business_objectives: Optional[str] = None
    greeting: Optional[str] = None
    fallback: Optional[str] = None
    handoff_rules: Optional[str] = None
    kb_strict: Optional[bool] = None
    temperature: Optional[float] = None


# ------- Knowledge -------
class KnowledgeTextCreate(BaseModel):
    assistant_id: str
    title: str
    content: str
    type: str = "text"  # text | qna


# ------- Playground -------
class PlaygroundMessage(BaseModel):
    assistant_id: str
    session_id: str
    message: str


# ------- Conversations -------
class ConversationCreate(BaseModel):
    channel: str = "simulator"
    contact_name: str
    contact_phone: str = ""
    assistant_id: str


class InboundMessage(BaseModel):
    text: str


class HumanMessage(BaseModel):
    text: str


class StatusUpdate(BaseModel):
    status: Optional[str] = None      # bot | human | resolved
    ai_paused: Optional[bool] = None
