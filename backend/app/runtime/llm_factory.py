from __future__ import annotations

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from app.config import get_settings


def normalize_model_name(model: str) -> str:
    return model


def is_gemini_model(model: str) -> bool:
    return model.startswith("gemini-")


def build_chat_model(model: str, temperature: float = 0.2):
    settings = get_settings()
    if is_gemini_model(model):
        if not settings.gemini_api_key:
            raise RuntimeError("GEMINI_API_KEY is not configured. Create a free key in Google AI Studio and add it to .env.")
        return ChatGoogleGenerativeAI(model=model, google_api_key=settings.gemini_api_key, temperature=temperature)
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not configured. Use a gemini-* agent for free-tier Gemini inference.")
    return ChatOpenAI(model=model, api_key=settings.openai_api_key, temperature=temperature)
