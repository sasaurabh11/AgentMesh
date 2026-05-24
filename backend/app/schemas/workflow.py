from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class WorkflowBase(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str = ""
    graph_definition: dict[str, Any]
    is_template: bool = False


class WorkflowCreate(WorkflowBase):
    """Payload for creating a workflow — validates the graph on write."""

    @model_validator(mode="after")
    def validate_graph(self):
        nodes = self.graph_definition.get("nodes", [])
        edges = self.graph_definition.get("edges", [])
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("graph_definition requires nodes and edges arrays")
        ids = {node.get("id") for node in nodes}
        if any(not node_id for node_id in ids):
            raise ValueError("every node requires an id")
        adjacency: dict[str, list[dict]] = {str(node_id): [] for node_id in ids}
        for edge in edges:
            if edge.get("source") not in ids or edge.get("target") not in ids:
                raise ValueError("edges must reference valid source and target node ids")
            adjacency[str(edge.get("source"))].append(edge)
        visiting: set[str] = set()
        visited: set[str] = set()

        def walk(node_id: str) -> bool:
            if node_id in visiting:
                return True
            if node_id in visited:
                return False
            visiting.add(node_id)
            for edge in adjacency.get(node_id, []):
                if edge.get("feedback_loop") is True:
                    continue
                if walk(str(edge.get("target"))):
                    return True
            visiting.remove(node_id)
            visited.add(node_id)
            return False

        if any(walk(str(node_id)) for node_id in ids):
            raise ValueError("circular dependency requires feedback_loop=true on the looping edge")
        return self


class WorkflowUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    graph_definition: dict[str, Any] | None = None
    is_template: bool | None = None


class WorkflowRead(WorkflowBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    created_at: datetime
    updated_at: datetime


class WorkflowExecuteRequest(BaseModel):
    input: str = Field(min_length=1)


class WorkflowExecuteResponse(BaseModel):
    execution_id: UUID
    status: str
