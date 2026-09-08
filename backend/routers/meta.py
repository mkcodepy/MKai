from fastapi import APIRouter
from ai_core import PROVIDER_MODELS, DEFAULT_MODEL, PROVIDER_LABELS, LENGTH_GUIDE, FORMALITY_GUIDE

router = APIRouter(prefix="/api/meta", tags=["meta"])

MODEL_HINTS = {
    "gpt-5.4": "Melhor qualidade OpenAI", "gpt-5.4-mini": "Rápido e econômico", "gpt-5.2": "Equilibrado",
    "gpt-4o": "Estável", "gpt-4o-mini": "Muito econômico", "o3": "Raciocínio avançado (lento)",
    "claude-sonnet-4-6": "Excelente em conversa natural", "claude-opus-4-6": "Máxima qualidade (caro)",
    "claude-haiku-4-5-20251001": "Rápido e econômico",
    "gemini-3.1-pro-preview": "Melhor qualidade Google", "gemini-2.5-pro": "Estável", "gemini-2.5-flash": "Rápido e econômico",
}


@router.get("/models")
async def models():
    return {"providers": PROVIDER_MODELS, "defaults": DEFAULT_MODEL, "labels": PROVIDER_LABELS, "hints": MODEL_HINTS,
            "response_lengths": list(LENGTH_GUIDE.keys()), "formalities": list(FORMALITY_GUIDE.keys())}
