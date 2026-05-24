from __future__ import annotations

import json
import logging
from redis.asyncio import Redis
from app.config import get_settings

logger = logging.getLogger(__name__)


async def publish_event(channel: str, event: dict) -> None:
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    try:
        await redis.publish(channel, json.dumps(event, default=str))
    except Exception as exc:
        logger.warning("Redis publish failed for %s: %s", channel, exc)
    finally:
        await redis.aclose()
