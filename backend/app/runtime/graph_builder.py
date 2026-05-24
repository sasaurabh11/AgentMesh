import re
from typing import Any
from langgraph.graph import END, StateGraph
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.agent import Agent
from app.models.workflow import Workflow
from app.runtime.agent_node import build_agent_node
from app.runtime.state import OrchestrationState


def _eval_condition(expr: str, state: OrchestrationState) -> bool:
    expression = (expr or "").strip()
    contains = re.match(
        r"agent_outputs\[['\"]([^'\"]+)['\"]\]\s+contains\s+['\"](.+)['\"]", expression
    )
    if contains:
        agent_key, needle = contains.groups()
        return needle.lower() in state.get("agent_outputs", {}).get(agent_key, "").lower()
    equals = re.match(r"agent_outputs\[['\"]([^'\"]+)['\"]\]\s*==\s*['\"](.+)['\"]", expression)
    if equals:
        agent_key, expected = equals.groups()
        return state.get("agent_outputs", {}).get(agent_key, "").strip() == expected
    if "quality = good" in expression.lower():
        return (
            "quality = good" in "\n".join(state.get("agent_outputs", {}).values()).lower()
            or "good" in "\n".join(state.get("agent_outputs", {}).values()).lower()
        )
    if "quality = revise" in expression.lower():
        return "revise" in "\n".join(state.get("agent_outputs", {}).values()).lower()
    return bool(expression and expression.lower() not in {"false", "0", "no"})


def _condition_router(node: dict[str, Any]):
    expr = node.get("condition_expr", "")

    def router(state: OrchestrationState) -> str:
        result = _eval_condition(expr, state)
        return "true" if result else "false"

    return router


async def build_graph(workflow: Workflow, db: AsyncSession):
    definition = workflow.graph_definition or {}
    nodes = definition.get("nodes", [])
    edges = definition.get("edges", [])
    graph = StateGraph(OrchestrationState)
    agent_ids = [
        node.get("agent_id")
        for node in nodes
        if node.get("type") == "agent" and node.get("agent_id")
    ]
    agents = {}
    if agent_ids:
        result = await db.execute(select(Agent).where(Agent.id.in_(agent_ids)))
        agents = {str(agent.id): agent for agent in result.scalars().all()}

    for node in nodes:
        node_id = node["id"]
        if node.get("type") == "agent":
            agent = agents.get(str(node.get("agent_id")))
            if not agent:
                raise ValueError(
                    f"agent node {node_id} references missing agent {node.get('agent_id')}"
                )
            graph.add_node(node_id, build_agent_node(agent))
        elif node.get("type") == "condition":

            async def passthrough(state: OrchestrationState) -> OrchestrationState:
                return state

            graph.add_node(node_id, passthrough)
    by_source: dict[str, list[dict]] = {}
    for edge in edges:
        by_source.setdefault(edge["source"], []).append(edge)

    starts = [node for node in nodes if node.get("type") == "start"]
    entry = None
    if starts and by_source.get(starts[0]["id"]):
        entry = by_source[starts[0]["id"]][0]["target"]
    elif nodes:
        entry = nodes[0]["id"]
    if not entry:
        raise ValueError("workflow graph has no entry point")
    graph.set_entry_point(entry)

    node_lookup = {node["id"]: node for node in nodes}
    for source, outgoing in by_source.items():
        source_type = node_lookup.get(source, {}).get("type")
        if source_type == "start":
            continue
        if source_type == "condition":
            mapping = {}
            for edge in outgoing:
                label = str(edge.get("label", "true")).lower()
                mapping[
                    "true" if label in {"true", "yes", "billing", "technical", "good"} else "false"
                ] = (
                    END
                    if node_lookup.get(edge["target"], {}).get("type") == "end"
                    else edge["target"]
                )
            mapping.setdefault("false", END)
            mapping.setdefault("true", END)
            graph.add_conditional_edges(source, _condition_router(node_lookup[source]), mapping)
        else:
            for edge in outgoing:
                target = edge["target"]
                graph.add_edge(
                    source, END if node_lookup.get(target, {}).get("type") == "end" else target
                )

    return graph.compile()
