import json
from redis.asyncio import Redis
from app.config import get_settings


async def publish_event(channel: str, event: dict) -> None:
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    try:
        await redis.publish(channel, json.dumps(event, default=str))
    finally:
        await redis.aclose()
