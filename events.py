from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.services.sse_broadcaster import sse_hub
import asyncio

router = APIRouter(tags=["Real-Time SSE Stream"])

@router.get("/events")
async def sse_stream():
    async def event_generator():
        q = await sse_hub.subscribe()
        try:
            yield "data: {\"type\": \"connected\"}\n\n"
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=20.0)
                    yield msg
                except asyncio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            sse_hub.unsubscribe(q)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )