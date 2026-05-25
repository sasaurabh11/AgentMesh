from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ENV_FILE), extra="ignore")

    database_url: str = Field(
        default="postgresql+asyncpg://user:password@postgres:5432/orchestration",
        alias="DATABASE_URL",
    )
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    gemini_api_key: str = Field(default="", alias="GEMINI_API_KEY")
    default_summary_model: str = Field(default="gemini-2.5-flash", alias="DEFAULT_SUMMARY_MODEL")
    telegram_bot_token: str = Field(default="", alias="TELEGRAM_BOT_TOKEN")
    telegram_webhook_secret: str = Field(default="", alias="TELEGRAM_WEBHOOK_SECRET")
    secret_key: str = Field(default="dev-secret", alias="SECRET_KEY")
    default_workflow_id: str | None = Field(default=None, alias="DEFAULT_WORKFLOW_ID")
    backend_cors_origins: str = Field(
        default="http://localhost:3000,http://localhost:5173", alias="BACKEND_CORS_ORIGINS"
    )
    public_base_url: str = Field(default="http://localhost:8000", alias="PUBLIC_BASE_URL")
    workspace_dir: str = Field(
        default=str(Path(__file__).resolve().parents[2] / "workspace"), alias="WORKSPACE_DIR"
    )
    tavily_api_key: str = Field(default="", alias="TAVILY_API_KEY")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
