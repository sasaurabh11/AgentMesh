import json
from collections.abc import AsyncGenerator
from redis.asyncio import Redis
from app.config import get_settings


async def subscribe(channel: str) -> AsyncGenerator[dict, None]:
    redis = Redis.from_url(get_settings().redis_url, decode_responses=True)
    pubsub = redis.pubsub()
    await pubsub.subscribe(channel)
    try:
        async for item in pubsub.listen():
            if item.get("type") == "message":
                yield json.loads(item["data"])
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()
        await redis.aclose()
