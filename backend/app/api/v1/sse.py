import asyncio
import json
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from app.services.alert_service import sse_subscribers

router = APIRouter(prefix="/sse", tags=["realtime"])

@router.get("/alerts")
async def alert_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint for real-time alert notifications.
    Clients receive JSON payloads immediately when any alert is triggered.
    """
    queue: asyncio.Queue = asyncio.Queue()
    sse_subscribers.add(queue)

    async def event_generator():
        try:
            # Send initial keepalive
            yield f"event: ping\ndata: {json.dumps({'status': 'connected'})}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=20.0)
                    if isinstance(item, dict) and "event" in item and "data" in item:
                        yield f"event: {item['event']}\ndata: {json.dumps(item['data'])}\n\n"
                    else:
                        yield f"event: alert\ndata: {json.dumps(item)}\n\n"
                except asyncio.TimeoutError:
                    # Heartbeat to keep connection alive
                    yield "event: ping\ndata: {}\n\n"
        finally:
            sse_subscribers.discard(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
