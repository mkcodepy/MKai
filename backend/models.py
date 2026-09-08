"""Modelos Pydantic (payloads de request)."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


# ------- Assistants -------
class FewShotExample(BaseModel):
    user: str = ""
    assistant: str = ""


class AssistantBase(BaseModel):
    # Identidade
    name: str
    description: Optional[str] = ""
    avatar_color: Optional[str] = "#0d9488"
    company_name: Optional[str] = ""
    company_description: Optional[str] = ""
    mission: Optional[str] = ""
    skills: List[str] = Field(default_factory=list)
    # Modelo
    provider: str = "openai"
    model: str = "gpt-5.4"
    fallback_provider: Optional[str] = None
    temperature: float = 0.5
    max_tokens: Optional[int] = 700
    language: str = "Português (Brasil)"
    # Personalidade e estilo
    personality: str = ""
    tone: str = ""
    response_length: str = "media"        # curta | media | longa
    formality: str = "neutro"             # informal | neutro | formal
    use_emojis: bool = True
    whatsapp_style: bool = True
    proactive_followup: bool = True
    # Instruções e regras
    role_instructions: str = ""
    rules: List[str] = Field(default_factory=list)
    forbidden_topics: List[str] = Field(default_factory=list)
    business_objectives: str = ""
    few_shot_examples: List[FewShotExample] = Field(default_factory=list)
    # Mensagens
    greeting: str = ""
    fallback: str = ""
    # Handoff e horários
    handoff_rules: str = ""
    escalation_keywords: List[str] = Field(default_factory=list)
    business_hours: Optional[str] = ""
    off_hours_message: Optional[str] = ""
    # Coleta de dados
    collect_lead_info: bool = False
    lead_fields: List[str] = Field(default_factory=lambda: ["nome", "e-mail"])
    # Conhecimento / memória
    kb_strict: bool = True
    retrieval_top_k: int = 5
    kb_min_score: float = 0.05
    kb_full_context_chars: int = 12000
    memory_window: int = 16
    template_key: Optional[str] = None


class AssistantCreate(AssistantBase):
    pass


class AssistantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    avatar_color: Optional[str] = None
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    mission: Optional[str] = None
    skills: Optional[List[str]] = None
    provider: Optional[str] = None
    model: Optional[str] = None
    fallback_provider: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None
    language: Optional[str] = None
    personality: Optional[str] = None
    tone: Optional[str] = None
    response_length: Optional[str] = None
    formality: Optional[str] = None
    use_emojis: Optional[bool] = None
    whatsapp_style: Optional[bool] = None
    proactive_followup: Optional[bool] = None
    role_instructions: Optional[str] = None
    rules: Optional[List[str]] = None
    forbidden_topics: Optional[List[str]] = None
    business_objectives: Optional[str] = None
    few_shot_examples: Optional[List[FewShotExample]] = None
    greeting: Optional[str] = None
    fallback: Optional[str] = None
    handoff_rules: Optional[str] = None
    escalation_keywords: Optional[List[str]] = None
    business_hours: Optional[str] = None
    off_hours_message: Optional[str] = None
    collect_lead_info: Optional[bool] = None
    lead_fields: Optional[List[str]] = None
    kb_strict: Optional[bool] = None
    retrieval_top_k: Optional[int] = None
    kb_min_score: Optional[float] = None
    kb_full_context_chars: Optional[int] = None
    memory_window: Optional[int] = None
    template_key: Optional[str] = None


class GenerateRequest(BaseModel):
    description: str
    provider: str = "openai"
    language: str = "Português (Brasil)"


class EvaluateRequest(BaseModel):
    questions: List[str]


# ------- Knowledge -------
class KnowledgeTextCreate(BaseModel):
    assistant_id: str
    title: str
    content: str
    type: str = "text"  # text | qna


class KnowledgeUrlCreate(BaseModel):
    assistant_id: str
    url: str
    title: Optional[str] = None


class KnowledgeSearch(BaseModel):
    assistant_id: str
    query: str
    top_k: int = 5


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


class NotesUpdate(BaseModel):
    notes: str = ""
    tags: Optional[List[str]] = None
    assistant_id: Optional[str] = None


class GenericPayload(BaseModel):
    data: Dict[str, Any] = Field(default_factory=dict)
