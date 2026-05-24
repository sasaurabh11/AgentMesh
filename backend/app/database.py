from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings


class Base(DeclarativeBase):
    """Declarative base for all ORM models."""


settings = get_settings()

_db_url = settings.database_url
_connect_args = {}
if "neon.tech" in _db_url:
    import ssl as _ssl

    _ssl_ctx = _ssl.create_default_context()
    _connect_args = {"ssl": _ssl_ctx}
    _db_url = _db_url.split("?")[0]

engine = create_async_engine(_db_url, pool_pre_ping=True, future=True, connect_args=_connect_args)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
