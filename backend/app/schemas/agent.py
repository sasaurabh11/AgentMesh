from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

ModelName = Literal["gpt-4o", "gpt-4o-mini", "claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5"]


class AgentBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    role: str = Field(min_length=1, max_length=255)
    system_prompt: str = Field(min_length=1)
    model: ModelName | str = "gpt-4o-mini"
    api_key: str | None = None
    tools: list[str] = Field(default_factory=list)
    memory_enabled: bool = False
    memory_config: dict[str, Any] = Field(default_factory=dict)
    guardrails: dict[str, Any] = Field(default_factory=dict)
    schedule: dict[str, Any] | None = None
    channel: Literal["telegram", "slack"] | None = None
    channel_config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("api_key", mode="before")
    @classmethod
    def _normalize_api_key(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class AgentCreate(AgentBase):
    """Payload for creating an agent."""


class AgentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    role: str | None = Field(default=None, min_length=1, max_length=255)
    system_prompt: str | None = Field(default=None, min_length=1)
    model: str | None = None
    api_key: str | None = None
    tools: list[str] | None = None
    memory_enabled: bool | None = None
    memory_config: dict[str, Any] | None = None
    guardrails: dict[str, Any] | None = None
    schedule: dict[str, Any] | None = None
    channel: str | None = None
    channel_config: dict[str, Any] | None = None

    @field_validator("api_key", mode="before")
    @classmethod
    def _normalize_api_key(cls, v: str | None) -> str | None:
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v


class AgentRead(AgentBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime
    has_api_key: bool = False
    # api_key is inherited from AgentBase but overridden to be excluded from responses
    api_key: str | None = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def _set_has_api_key(self) -> "AgentRead":
        self.has_api_key = bool(self.api_key)
        return self


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AgentTestRequest(BaseModel):
    input: str = Field(min_length=1)
    messages: list[ChatMessage] = Field(default_factory=list)


class ToolStep(BaseModel):
    tool: str
    input: str
    output: str


class AgentTestResponse(BaseModel):
    output: str
    tokens: int
    cost_usd: float
    steps: list[ToolStep] = Field(default_factory=list)
