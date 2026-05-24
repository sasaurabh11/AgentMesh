from __future__ import annotations

from langchain.memory import ConversationBufferWindowMemory, ConversationSummaryBufferMemory
from langchain_openai import ChatOpenAI
from app.config import get_settings
from app.models.agent import Agent


_memory_cache: dict[str, object] = {}


def buffer_memory(
    agent_id: str, execution_id: str, window_size: int = 8
) -> ConversationBufferWindowMemory:
    key = f"buffer:{agent_id}:{execution_id}"
    if key not in _memory_cache:
        _memory_cache[key] = ConversationBufferWindowMemory(
            k=window_size, return_messages=True, memory_key="chat_history"
        )
    return _memory_cache[key]


def summary_memory(agent_id: str) -> ConversationSummaryBufferMemory:
    key = f"summary:{agent_id}"
    if key not in _memory_cache:
        settings = get_settings()
        llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.openai_api_key)
        _memory_cache[key] = ConversationSummaryBufferMemory(
            llm=llm, max_token_limit=1500, return_messages=True, memory_key="chat_history"
        )
    return _memory_cache[key]


def get_memory(agent: Agent, execution_id: str | None = None):
    if not agent.memory_enabled:
        return None
    config = agent.memory_config or {}
    memory_type = config.get("type", "buffer")
    if memory_type == "summary":
        return summary_memory(str(agent.id))
    if memory_type == "buffer":
        return buffer_memory(
            str(agent.id), execution_id or "manual", int(config.get("window_size", 8))
        )
    return None
