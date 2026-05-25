import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.queue.consumer import subscribe

router = APIRouter(tags=["websocket"])

HEARTBEAT_INTERVAL = 15  # seconds


@router.websocket("/ws/executions/{execution_id}/logs")
async def execution_logs_ws(websocket: WebSocket, execution_id: str):
    await websocket.accept()

    async def stream():
        async for event in subscribe(f"execution:{execution_id}:logs"):
            await websocket.send_json(event)
            # Stop streaming once the execution reaches a terminal state
            if event.get("type") in ("completed", "error"):
                break

    async def heartbeat():
        try:
            while True:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                await websocket.send_json({"type": "heartbeat"})
        except (WebSocketDisconnect, Exception):
            pass  # client disconnected — exit silently

    stream_task = asyncio.create_task(stream())
    hb_task = asyncio.create_task(heartbeat())

    try:
        done, pending = await asyncio.wait(
            {stream_task, hb_task},
            return_when=asyncio.FIRST_COMPLETED,
        )
        for t in pending:
            t.cancel()
            try:
                await t
            except (asyncio.CancelledError, WebSocketDisconnect, Exception):
                pass
    except (WebSocketDisconnect, Exception):
        stream_task.cancel()
        hb_task.cancel()
