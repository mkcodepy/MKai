import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import assistants, knowledge_chunks
from models import PlaygroundMessage
from ai_core import stream_reply

router = APIRouter(prefix="/api/playground", tags=["playground"])

# histórico em memória por sessão (efêmero, apenas para teste no Playground)
_SESSIONS = {}


@router.post("/stream")
async def playground_stream(payload: PlaygroundMessage):
    cfg = await assistants.find_one({"id": payload.assistant_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(404, "Assistente não encontrado")
    chunks = await knowledge_chunks.find({"assistant_id": payload.assistant_id},
                                         {"_id": 0, "text": 1, "source_title": 1, "source_id": 1}).to_list(5000)
    history = _SESSIONS.setdefault(payload.session_id, [])
    prior = list(history)
    history.append({"role": "customer", "text": payload.message})

    async def gen():
        try:
            async for ev in stream_reply(cfg, chunks, prior, payload.message, payload.session_id):
                if ev.get("done"):
                    history.append({"role": "assistant", "text": ev["clean"]})
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"
        except Exception as e:  # noqa: BLE001
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/reset")
async def reset_session(session_id: str):
    _SESSIONS.pop(session_id, None)
    return {"ok": True}
