from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from redis.asyncio import Redis

from app.config import get_settings
from app.queue.producer import publish_event

WAIT_TIMEOUT = 300  # 5 minutes


async def request_input(execution_id: str, question: str, timeout: int = WAIT_TIMEOUT) -> str:
    """
    Publish a waiting_for_input event, then block until the user submits a response
    via POST /api/executions/{id}/input.  Raises TimeoutError if no response arrives.
    """
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    waiting_key = f"execution:{execution_id}:waiting"
    input_key = f"execution:{execution_id}:human_input"

    try:
        await redis.set(waiting_key, question, ex=timeout + 30)

        # Persist to DB so polling queries can find it even if WebSocket is disconnected
        from uuid import UUID
        from app.database import AsyncSessionLocal
        from app.models.execution import ExecutionLog

        async with AsyncSessionLocal() as db:
            db.add(ExecutionLog(
                execution_id=UUID(execution_id),
                log_type="waiting_for_input",
                content=question,
                metadata_={"prompt": question, "timeout": timeout},
            ))
            await db.commit()

        await publish_event(
            f"execution:{execution_id}:logs",
            {
                "type": "waiting_for_input",
                "agent_id": None,
                "content": question,
                "metadata": {"prompt": question, "timeout": timeout},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )

        deadline = asyncio.get_event_loop().time() + timeout
        while asyncio.get_event_loop().time() < deadline:
            value = await redis.get(input_key)
            if value:
                await redis.delete(input_key)
                await redis.delete(waiting_key)
                return value
            await asyncio.sleep(1)

    finally:
        await redis.aclose()

    raise TimeoutError(
        f"Workflow timed out after {timeout}s waiting for user input. Please re-run and respond promptly."
    )


async def submit_input(execution_id: str, text: str) -> bool:
    """Store the user's response so request_input() can pick it up. Returns False if not waiting."""
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    waiting_key = f"execution:{execution_id}:waiting"
    input_key = f"execution:{execution_id}:human_input"
    try:
        is_waiting = await redis.get(waiting_key)
        if not is_waiting:
            return False
        await redis.set(input_key, text, ex=3600)
        return True
    finally:
        await redis.aclose()
