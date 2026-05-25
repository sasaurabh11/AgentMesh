from __future__ import annotations

import time
from datetime import datetime, timezone
from uuid import UUID

import redis as sync_redis
from redis.asyncio import Redis

from app.config import get_settings
from app.queue.producer import publish_event

WAIT_TIMEOUT = 300  # 5 minutes


async def publish_waiting(execution_id: str, question: str, timeout: int = WAIT_TIMEOUT) -> None:
    """
    Called on the main event loop (via run_coroutine_threadsafe from the tool thread).
    Persists the waiting_for_input log, sets the Redis flag, and publishes the WebSocket event.
    """
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    try:
        await redis.set(f"execution:{execution_id}:waiting", question, ex=timeout + 30)
    finally:
        await redis.aclose()

    # Persist to DB so polling queries surface the question even when WebSocket is down
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


def poll_input_sync(execution_id: str, timeout: int = WAIT_TIMEOUT) -> str:
    """
    Blocking (synchronous) poll using the non-async Redis client.
    Safe to call from a thread without any event loop.
    """
    r = sync_redis.Redis.from_url(get_settings().redis_url, decode_responses=True)
    input_key = f"execution:{execution_id}:human_input"
    waiting_key = f"execution:{execution_id}:waiting"
    deadline = time.time() + timeout
    try:
        while time.time() < deadline:
            value = r.get(input_key)
            if value:
                r.delete(input_key)
                r.delete(waiting_key)
                return value
            time.sleep(1)
    finally:
        r.close()

    raise TimeoutError(
        f"Workflow timed out after {timeout}s waiting for user input. Please re-run and respond promptly."
    )


async def submit_input(execution_id: str, text: str) -> bool:
    """Store the user's response so poll_input_sync() can pick it up. Returns False if not waiting."""
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    try:
        is_waiting = await redis.get(f"execution:{execution_id}:waiting")
        if not is_waiting:
            return False
        await redis.set(f"execution:{execution_id}:human_input", text, ex=3600)
        return True
    finally:
        await redis.aclose()
