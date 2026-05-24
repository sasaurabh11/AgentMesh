from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field

ModelName = Literal["gpt-4o", "gpt-4o-mini", "claude-sonnet-4-6", "claude-haiku-4-5"]


class AgentBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    system_prompt: str = Field(min_length=1)
    model: ModelName | str = "gpt-4o-mini"
    tools: list[str] = Field(default_factory=list)
    memory_enabled: bool = False
    memory_config: dict[str, Any] = Field(default_factory=dict)
    guardrails: dict[str, Any] = Field(default_factory=dict)
    schedule: dict[str, Any] | None = None
    channel: Literal["telegram", "slack"] | None = None
    channel_config: dict[str, Any] = Field(default_factory=dict)


class AgentCreate(AgentBase):
    """Payload for creating an agent."""


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    role: str | None = Field(default=None, min_length=1, max_length=255)
    system_prompt: str | None = Field(default=None, min_length=1)
    model: str | None = None
    tools: list[str] | None = None
    memory_enabled: bool | None = None
    memory_config: dict[str, Any] | None = None
    guardrails: dict[str, Any] | None = None
    schedule: dict[str, Any] | None = None
    channel: str | None = None
    channel_config: dict[str, Any] | None = None


class AgentRead(AgentBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


class AgentTestRequest(BaseModel):
    input: str = Field(min_length=1)


class AgentTestResponse(BaseModel):
    output: str
    tokens: int
    cost_usd: float
