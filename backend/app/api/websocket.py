from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.queue.consumer import subscribe

router = APIRouter(tags=["websocket"])


@router.websocket("/ws/executions/{execution_id}/logs")
async def execution_logs_ws(websocket: WebSocket, execution_id: str):
    await websocket.accept()
    try:
        async for event in subscribe(f"execution:{execution_id}:logs"):
            await websocket.send_json(event)
    except WebSocketDisconnect:
        return
