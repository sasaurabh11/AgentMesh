import logging
from contextlib import asynccontextmanager
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.agents import router as agents_router
from app.api.executions import router as executions_router
from app.api.messages import router as messages_router
from app.api.websocket import router as websocket_router
from app.api.workflows import router as workflows_router
from app.channels.telegram import router as telegram_router
from app.config import get_settings
from app.utils.logger import configure_logging

configure_logging()
settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=3)
        await r.ping()
        await r.aclose()
        logger.info("Redis connected: %s", settings.redis_url)
    except Exception as e:
        logger.warning("Redis not available: %s", e)
    yield


app = FastAPI(title="AgentMesh AI Orchestration Platform", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(agents_router)
app.include_router(workflows_router)
app.include_router(executions_router)
app.include_router(messages_router)
app.include_router(websocket_router)
app.include_router(telegram_router)


@app.get("/health")
async def health():
    return {"status": "ok"}
