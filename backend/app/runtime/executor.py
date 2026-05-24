from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID
from langchain_core.messages import HumanMessage
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.execution import Execution, ExecutionLog
from app.models.message import Message
from app.models.workflow import Workflow
from app.queue.producer import publish_event
from app.runtime.graph_builder import build_graph


async def execute_workflow(
    workflow_id: str,
    input_text: str,
    trigger_channel: str,
    execution_id: str | None = None,
    telegram_chat_id: str | None = None,
) -> str:
    async with AsyncSessionLocal() as db:
        execution = None
        if execution_id:
            execution = await db.get(Execution, UUID(execution_id))
        if execution is None:
            execution = Execution(
                workflow_id=UUID(workflow_id),
                trigger_channel=trigger_channel,
                trigger_input=input_text,
                status="pending",
            )
            db.add(execution)
            await db.flush()
            execution_id = str(execution.id)
        execution.status = "running"
        execution.started_at = datetime.now(timezone.utc)
        db.add(
            Message(
                execution_id=execution.id,
                channel=trigger_channel,
                direction="inbound",
                content=input_text,
                telegram_chat_id=telegram_chat_id,
            )
        )
        workflow = await db.get(Workflow, UUID(workflow_id))
        if not workflow:
            raise ValueError("workflow not found")
        graph = await build_graph(workflow, db)
        await db.commit()

    final_state = None
    try:
        initial_state = {
            "input": input_text,
            "messages": [HumanMessage(content=input_text)],
            "current_agent_id": "",
            "agent_outputs": {},
            "inter_agent_messages": [],
            "execution_id": execution_id,
            "token_usage": {},
            "cost_usd": {},
            "error": None,
            "next": "",
        }
        async for update in graph.astream(initial_state):
            if isinstance(update, dict):
                final_state = next(
                    (value for value in update.values() if isinstance(value, dict)), final_state
                )
                await publish_event(
                    f"execution:{execution_id}:logs",
                    {
                        "type": "state_update",
                        "agent_id": None,
                        "content": "Graph state advanced",
                        "metadata": {"nodes": list(update.keys())},
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    },
                )
        final_state = final_state or initial_state
        total_tokens = sum(final_state.get("token_usage", {}).values())
        total_cost = round(sum(final_state.get("cost_usd", {}).values()), 8)
        outputs = final_state.get("agent_outputs", {})
        final_output = list(outputs.values())[-1] if outputs else ""
        async with AsyncSessionLocal() as db:
            execution = await db.get(Execution, UUID(execution_id))
            if execution:
                execution.status = "completed"
                execution.completed_at = datetime.now(timezone.utc)
                execution.total_tokens = total_tokens
                execution.total_cost_usd = total_cost
                db.add(
                    Message(
                        execution_id=execution.id,
                        channel=trigger_channel,
                        direction="outbound",
                        content=final_output,
                        telegram_chat_id=telegram_chat_id,
                    )
                )
                db.add(
                    ExecutionLog(
                        execution_id=execution.id,
                        log_type="agent_output",
                        content="Workflow completed",
                        metadata_={
                            "total_tokens": total_tokens,
                            "total_cost_usd": total_cost,
                            "final_output": final_output,
                        },
                    )
                )
                await db.commit()
        await publish_event(
            f"execution:{execution_id}:logs",
            {
                "type": "completed",
                "agent_id": None,
                "content": final_output,
                "metadata": {"total_tokens": total_tokens, "total_cost_usd": total_cost},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        return str(execution_id)
    except Exception as exc:
        async with AsyncSessionLocal() as db:
            execution = await db.get(Execution, UUID(execution_id))
            if execution:
                execution.status = "failed"
                execution.completed_at = datetime.now(timezone.utc)
                db.add(
                    ExecutionLog(
                        execution_id=execution.id, log_type="error", content=str(exc), metadata_={}
                    )
                )
                await db.commit()
        await publish_event(
            f"execution:{execution_id}:logs",
            {
                "type": "error",
                "agent_id": None,
                "content": str(exc),
                "metadata": {},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
        raise
