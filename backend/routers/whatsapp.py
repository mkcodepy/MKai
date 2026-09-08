"""Canal WhatsApp.

O ambiente Emergent (sandbox) normalmente NÃO consegue executar Baileys (WhatsApp Web)
de forma persistente. Portanto:
  - Este router mantém o ESTADO do canal e uma BRIDGE HTTP que o microserviço Node
    (whatsapp-service, baseado em Baileys) usa para reportar QR/status e entregar
    mensagens recebidas -> /api/whatsapp/inbound.
  - Para permitir teste ponta a ponta AQUI, expomos o mesmo pipeline via SIMULADOR
    (rota inbound das conversas) — ver routers/conversations.py.
  - Mensagens do atendente humano em conversas 'whatsapp' são enviadas ao cliente via
    POST {WHATSAPP_SERVICE_URL}/send (ver routers/conversations.py::push_to_whatsapp).

Quando rodar externamente, basta subir o whatsapp-service apontando BACKEND_URL
para este backend; nenhuma reconstrução do app é necessária.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter
from pydantic import BaseModel
from database import channels, conversations, assistants
from routers.conversations import _add_message, _run_ai_reply, WHATSAPP_SERVICE_URL

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
CHANNEL_ID = "whatsapp"


def _now():
    return datetime.now(timezone.utc).isoformat()


class QRUpdate(BaseModel):
    qr: str


class StatusReport(BaseModel):
    status: str            # disconnected | connecting | connected
    phone: str = ""


class WhatsappSettings(BaseModel):
    assistant_id: Optional[str] = None
    auto_reply: Optional[bool] = None
    reply_delay_ms: Optional[int] = None       # "tempo de digitação" simulado por mensagem
    debounce_ms: Optional[int] = None          # agrupa mensagens seguidas do cliente
    ignore_groups: Optional[bool] = None
    split_long_messages: Optional[bool] = None


class WhatsappInbound(BaseModel):
    phone: str
    name: str = ""
    text: str


DEFAULT_SETTINGS = {"auto_reply": True, "reply_delay_ms": 1500, "debounce_ms": 2500,
                    "ignore_groups": True, "split_long_messages": True}


async def _get_state():
    st = await channels.find_one({"id": CHANNEL_ID}, {"_id": 0})
    if not st:
        st = {"id": CHANNEL_ID, "status": "disconnected", "qr": None, "phone": "",
              "assistant_id": None, "updated_at": _now(), "mode": "simulator", **DEFAULT_SETTINGS}
        await channels.insert_one(dict(st))
        st.pop("_id", None)
    for k, v in DEFAULT_SETTINGS.items():
        st.setdefault(k, v)
    st["service_url"] = WHATSAPP_SERVICE_URL
    return st


async def _default_assistant_id(state):
    if state.get("assistant_id") and await assistants.find_one({"id": state["assistant_id"]}):
        return state["assistant_id"]
    a = await assistants.find_one({}, {"_id": 0, "id": 1})
    return a["id"] if a else None


@router.get("/status")
async def get_status():
    return await _get_state()


@router.get("/settings")
async def get_settings():
    """Usado pelo microserviço para ler preferências operacionais (debounce, delay etc.)."""
    st = await _get_state()
    return {k: st.get(k) for k in DEFAULT_SETTINGS}


@router.post("/connect")
async def connect():
    """Inicia a conexão. Sem o microserviço externo, gera um QR de demonstração
    e permanece em 'connecting' (o app externo assumirá quando ativado)."""
    await _get_state()
    demo_qr = f"whatsapp-demo-session-{uuid.uuid4().hex[:12]}"
    await channels.update_one({"id": CHANNEL_ID},
                              {"$set": {"status": "connecting", "qr": demo_qr,
                                        "updated_at": _now(), "mode": "simulator"}})
    return await _get_state()


@router.post("/disconnect")
async def disconnect():
    await _get_state()
    await channels.update_one({"id": CHANNEL_ID},
                              {"$set": {"status": "disconnected", "qr": None, "phone": "",
                                        "updated_at": _now()}})
    return await _get_state()


# ----- Bridge para o microserviço Node (Baileys) — usado em ativação externa -----
@router.post("/bridge/qr")
async def bridge_qr(payload: QRUpdate):
    await _get_state()
    await channels.update_one({"id": CHANNEL_ID},
                              {"$set": {"qr": payload.qr, "status": "connecting",
                                        "mode": "live", "updated_at": _now()}})
    return {"ok": True}


@router.post("/bridge/status")
async def bridge_status(payload: StatusReport):
    await _get_state()
    upd = {"status": payload.status, "mode": "live", "updated_at": _now(), "last_seen_at": _now()}
    if payload.status == "connected":
        upd["qr"] = None
        upd["phone"] = payload.phone
    await channels.update_one({"id": CHANNEL_ID}, {"$set": upd})
    return {"ok": True}


@router.patch("/settings")
async def update_settings(payload: WhatsappSettings):
    await _get_state()
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    upd["updated_at"] = _now()
    await channels.update_one({"id": CHANNEL_ID}, {"$set": upd})
    return await _get_state()


@router.post("/inbound")
async def whatsapp_inbound(payload: WhatsappInbound):
    """Mensagem recebida do WhatsApp (via microserviço Baileys em ativação externa).

    Encontra/cria a conversa pelo telefone, roda a IA (se ativa) e retorna a
    resposta para o microserviço enviar de volta ao cliente.
    """
    state = await _get_state()
    conv = await conversations.find_one(
        {"channel": "whatsapp", "contact_phone": payload.phone, "status": {"$ne": "resolved"}}, {"_id": 0})
    if not conv:
        aid = await _default_assistant_id(state)
        if not aid:
            return {"reply": None, "error": "Nenhum assistente configurado"}
        conv = {
            "id": str(uuid.uuid4()), "channel": "whatsapp",
            "contact_name": payload.name or payload.phone, "contact_phone": payload.phone,
            "assistant_id": aid, "status": "bot", "ai_paused": False, "handoff": False,
            "unread": 0, "notes": "", "tags": [], "ai_tags": [], "summary": "", "sentiment": "neutro",
            "last_message": "", "last_message_at": _now(), "created_at": _now(),
        }
        await conversations.insert_one(dict(conv))
        conv.pop("_id", None)
    elif payload.name and conv.get("contact_name") == conv.get("contact_phone"):
        await conversations.update_one({"id": conv["id"]}, {"$set": {"contact_name": payload.name}})

    await _add_message(conv["id"], "customer", payload.text)
    await conversations.update_one({"id": conv["id"]},
                                   {"$set": {"last_message": payload.text, "last_message_at": _now()},
                                    "$inc": {"unread": 1}})

    if not state.get("auto_reply", True) or conv.get("ai_paused") or conv.get("status") == "human":
        return {"reply": None, "ai_paused": True, "conversation_id": conv["id"]}

    ai_msg = await _run_ai_reply(conv, payload.text)
    reply = ai_msg["text"] if ai_msg else None
    handoff = ai_msg["handoff"] if ai_msg else False
    if ai_msg:
        await conversations.update_one({"id": conv["id"]}, {"$set": {"unread": 0}})
    return {"reply": reply, "handoff": handoff, "conversation_id": conv["id"],
            "split": bool(state.get("split_long_messages", True)), "reply_delay_ms": int(state.get("reply_delay_ms", 1500))}
