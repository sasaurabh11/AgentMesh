from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from uuid import UUID
from langchain.agents import AgentExecutor, create_openai_tools_agent
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.agent import Agent
from app.models.execution import ExecutionLog
from app.queue.producer import publish_event
from app.runtime.memory_manager import get_memory
from app.runtime.llm_factory import build_chat_model, normalize_model_name
from app.runtime.state import OrchestrationState
from app.runtime.tool_registry import get_tools
from app.utils.cost_tracker import calculate_cost, count_tokens


async def _persist_log(
    execution_id: str, agent_id: str | None, log_type: str, content: str, metadata: dict
) -> None:
    async with AsyncSessionLocal() as db:
        db.add(
            ExecutionLog(
                execution_id=UUID(execution_id),
                agent_id=UUID(agent_id) if agent_id else None,
                log_type=log_type,
                content=content,
                metadata_=metadata,
            )
        )
        await db.commit()
    await publish_event(
        f"execution:{execution_id}:logs",
        {
            "type": log_type,
            "agent_id": agent_id,
            "content": content,
            "metadata": metadata,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


def build_agent_node(agent: Agent) -> Callable[[OrchestrationState], OrchestrationState]:
    selected_tools = get_tools(agent.tools or [])
    llm = build_chat_model(agent.model, temperature=0.2)
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", agent.system_prompt),
            MessagesPlaceholder("chat_history", optional=True),
            ("human", "{input}"),
            MessagesPlaceholder("agent_scratchpad"),
        ]
    )
    lc_agent = create_openai_tools_agent(llm, selected_tools, prompt)
    executor = AgentExecutor(
        agent=lc_agent, tools=selected_tools, verbose=False, return_intermediate_steps=True
    )

    async def node(state: OrchestrationState) -> OrchestrationState:
        execution_id = state["execution_id"]
        agent_id = str(agent.id)
        await _persist_log(
            execution_id, agent_id, "agent_start", f"{agent.name} started", {"model": agent.model}
        )
        state["current_agent_id"] = agent_id
        memory = get_memory(agent, execution_id)
        history = memory.load_memory_variables({}).get("chat_history", []) if memory else []
        previous = "\n".join(
            f"{key}: {value}" for key, value in state.get("agent_outputs", {}).items()
        )
        user_input = (
            f"Original input:\n{state['input']}\n\nPrevious agent outputs:\n{previous}"
            if previous
            else state["input"]
        )
        response = await executor.ainvoke({"input": user_input, "chat_history": history})
        output = str(response.get("output", ""))
        for action, result in response.get("intermediate_steps", []):
            tool_name = getattr(action, "tool", "tool")
            await _persist_log(
                execution_id,
                agent_id,
                "tool_call",
                str(getattr(action, "tool_input", "")),
                {"tool_name": tool_name},
            )
            await _persist_log(
                execution_id, agent_id, "tool_result", str(result), {"tool_name": tool_name}
            )
        if memory:
            memory.save_context({"input": user_input}, {"output": output})
        input_tokens = count_tokens(user_input + agent.system_prompt, normalize_model_name(agent.model))
        output_tokens = count_tokens(output, normalize_model_name(agent.model))
        total_tokens = input_tokens + output_tokens
        cost = calculate_cost(agent.model, input_tokens, output_tokens)
        state.setdefault("agent_outputs", {})[agent_id] = output
        state.setdefault("token_usage", {})[agent_id] = (
            state.get("token_usage", {}).get(agent_id, 0) + total_tokens
        )
        state.setdefault("cost_usd", {})[agent_id] = round(
            state.get("cost_usd", {}).get(agent_id, 0.0) + cost, 8
        )
        state.setdefault("messages", []).extend(
            [HumanMessage(content=user_input), SystemMessage(content=output)]
        )
        await _persist_log(
            execution_id,
            agent_id,
            "agent_output",
            output,
            {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "token_count": total_tokens,
                "cost": cost,
            },
        )
        return state

    return node
