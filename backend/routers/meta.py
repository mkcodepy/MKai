from fastapi import APIRouter
from ai_core import PROVIDER_MODELS, DEFAULT_MODEL

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/models")
async def models():
    return {"providers": PROVIDER_MODELS, "defaults": DEFAULT_MODEL}
