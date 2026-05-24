from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telegram import Bot, Update
from app.config import get_settings
from app.database import get_db
from app.models.agent import Agent
from app.models.execution import Execution
from app.models.workflow import Workflow
from app.runtime.executor import execute_workflow

router = APIRouter(tags=["telegram"])


async def send_telegram_reply(chat_id: str, text: str) -> None:
    token = get_settings().telegram_bot_token
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    await Bot(token=token).send_message(chat_id=chat_id, text=text)


async def _resolve_workflow(db: AsyncSession) -> Workflow | None:
    settings = get_settings()
    if settings.default_workflow_id:
        workflow = await db.get(Workflow, UUID(settings.default_workflow_id))
        if workflow:
            return workflow
    result = await db.execute(select(Agent).where(Agent.channel == "telegram"))
    agent = result.scalars().first()
    if not agent:
        result = await db.execute(
            select(Workflow)
            .where(Workflow.is_template.is_(False))
            .order_by(Workflow.created_at.desc())
        )
        return result.scalars().first()
    result = await db.execute(select(Workflow).order_by(Workflow.created_at.desc()))
    for workflow in result.scalars().all():
        graph = workflow.graph_definition or {}
        if any(str(node.get("agent_id")) == str(agent.id) for node in graph.get("nodes", [])):
            return workflow
    return None


@router.post("/webhook/telegram")
async def telegram_webhook(
    request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
):
    token = get_settings().telegram_bot_token
    body = await request.json()
    update = Update.de_json(body, Bot(token=token or "000:placeholder"))
    message = update.effective_message
    if not message or not message.text or not update.effective_chat:
        return {"ok": True, "ignored": True}
    chat_id = str(update.effective_chat.id)
    workflow = await _resolve_workflow(db)
    if not workflow:
        raise HTTPException(status_code=404, detail="no telegram workflow configured")
    execution = Execution(
        workflow_id=workflow.id,
        trigger_channel="telegram",
        trigger_input=message.text,
        status="pending",
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    background_tasks.add_task(
        execute_workflow, str(workflow.id), message.text, "telegram", str(execution.id), chat_id
    )
    if token:
        background_tasks.add_task(send_telegram_reply, chat_id, "Processing your request...")
    return {"ok": True, "execution_id": str(execution.id)}


@router.post("/api/settings/telegram/register")
async def register_telegram_webhook(webhook_url: str):
    token = get_settings().telegram_bot_token
    if not token:
        raise HTTPException(status_code=400, detail="TELEGRAM_BOT_TOKEN is not configured")
    result = await Bot(token=token).set_webhook(webhook_url)
    return {"ok": bool(result), "webhook_url": webhook_url}
