import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from database import assistants, knowledge_chunks
from models import PlaygroundMessage
from ai_core import stream_reply, parse_handoff

router = APIRouter(prefix="/api/playground", tags=["playground"])

# histórico em memória por sessão (efêmero, apenas para teste no Playground)
_SESSIONS = {}


@router.post("/stream")
async def playground_stream(payload: PlaygroundMessage):
    cfg = await assistants.find_one({"id": payload.assistant_id}, {"_id": 0})
    if not cfg:
        raise HTTPException(404, "Assistente não encontrado")
    chunks = [c["text"] for c in await knowledge_chunks.find(
        {"assistant_id": payload.assistant_id}, {"_id": 0, "text": 1}).to_list(2000)]
    history = _SESSIONS.setdefault(payload.session_id, [])
    history.append({"role": "customer", "text": payload.message})

    async def gen():
        buffer = []
        try:
            async for token in stream_reply(cfg, chunks, history[:-1], payload.message, payload.session_id):
                buffer.append(token)
                # não vazar a etiqueta de handoff no stream
                safe = token.replace("[", "").replace("]", "") if "HANDOFF" in "".join(buffer[-3:]) else token
                yield f"data: {json.dumps({'delta': token})}\n\n"
            full = "".join(buffer)
            clean, handoff = parse_handoff(full)
            history.append({"role": "assistant", "text": clean})
            yield f"data: {json.dumps({'done': True, 'handoff': handoff, 'clean': clean})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/reset")
async def reset_session(session_id: str):
    _SESSIONS.pop(session_id, None)
    return {"ok": True}
