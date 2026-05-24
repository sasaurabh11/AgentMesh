from typing import Optional, TypedDict
from langchain_core.messages import BaseMessage


class OrchestrationState(TypedDict, total=False):
    input: str
    messages: list[BaseMessage]
    current_agent_id: str
    agent_outputs: dict[str, str]
    inter_agent_messages: list[dict]
    execution_id: str
    token_usage: dict[str, int]
    cost_usd: dict[str, float]
    error: Optional[str]
    next: str
