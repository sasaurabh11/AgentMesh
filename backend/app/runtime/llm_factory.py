from __future__ import annotations

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from app.config import get_settings


def normalize_model_name(model: str) -> str:
    return model


def is_gemini_model(model: str) -> bool:
    return model.startswith("gemini-") or model.startswith("gemma-")


def is_claude_model(model: str) -> bool:
    return model.startswith("claude-")


def build_chat_model(model: str, temperature: float = 0.2, api_key: str | None = None):
    settings = get_settings()

    if is_gemini_model(model):
        key = api_key or settings.gemini_api_key
        if not key:
            raise RuntimeError(
                "No Google API key configured. Add GEMINI_API_KEY to .env or set one on the agent."
            )
        kwargs: dict = dict(model=model, google_api_key=key, temperature=temperature)
        if "2.5" in model:
            kwargs["thinking_budget"] = 0
        return ChatGoogleGenerativeAI(**kwargs)

    if is_claude_model(model):
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError:
            raise RuntimeError(
                "langchain-anthropic is not installed. Run: pip install langchain-anthropic"
            )
        key = api_key or settings.anthropic_api_key
        if not key:
            raise RuntimeError(
                "No Anthropic API key configured. Add ANTHROPIC_API_KEY to .env or set one on the agent."
            )
        return ChatAnthropic(model=model, api_key=key, temperature=temperature)

    # OpenAI (default)
    key = api_key or settings.openai_api_key
    if not key:
        raise RuntimeError(
            "No OpenAI API key configured. Add OPENAI_API_KEY to .env or set one on the agent."
        )
    return ChatOpenAI(model=model, api_key=key, temperature=temperature)
