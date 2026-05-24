from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class ExecutionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    workflow_id: UUID
    trigger_channel: str
    trigger_input: str
    status: str
    started_at: datetime | None
    completed_at: datetime | None
    total_tokens: int
    total_cost_usd: float


class ExecutionLogRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    execution_id: UUID
    agent_id: UUID | None
    log_type: str
    content: str
    metadata: dict[str, Any] = Field(validation_alias="metadata_")
    created_at: datetime


class ExecutionDetail(ExecutionRead):
    logs: list[ExecutionLogRead] = []
