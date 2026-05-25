from __future__ import annotations

from uuid import UUID
import redis.asyncio as aioredis
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from telegram import Bot, Update, InlineKeyboardMarkup, InlineKeyboardButton
from app.config import get_settings
from app.database import get_db
from app.models.agent import Agent
from app.models.execution import Execution
from app.models.workflow import Workflow
from app.runtime.executor import execute_workflow

router = APIRouter(tags=["telegram"])

_USER_WORKFLOW_KEY = "telegram:user:{}:workflow_id"   # per-user selected workflow
_USER_WORKFLOW_NAME_KEY = "telegram:user:{}:workflow_name"


async def _get_redis():
    return aioredis.from_url(get_settings().redis_url, decode_responses=True)


async def send_telegram_reply(chat_id: str, text: str, parse_mode: str | None = None) -> None:
    token = get_settings().telegram_bot_token
    if not token:
        return
    kwargs: dict = {"chat_id": chat_id, "text": text}
    if parse_mode:
        kwargs["parse_mode"] = parse_mode
    await Bot(token=token).send_message(**kwargs)


async def _get_telegram_workflows(db: AsyncSession) -> list[Workflow]:
    """Return all non-template workflows that contain at least one telegram-channel agent."""
    agent_result = await db.execute(select(Agent).where(Agent.channel == "telegram"))
    telegram_agent_ids = {str(a.id) for a in agent_result.scalars().all()}

    wf_result = await db.execute(
        select(Workflow).where(Workflow.is_template.is_(False)).order_by(Workflow.created_at.desc())
    )
    all_workflows = wf_result.scalars().all()

    if not telegram_agent_ids:
        return list(all_workflows)  # no agents marked — show all workflows

    return [
        wf for wf in all_workflows
        if any(
            str(n.get("agent_id")) in telegram_agent_ids
            for n in (wf.graph_definition or {}).get("nodes", [])
        )
    ]


async def _get_user_workflow(chat_id: str, db: AsyncSession) -> Workflow | None:
    """Get the workflow the user previously selected."""
    try:
        r = await _get_redis()
        wf_id = await r.get(_USER_WORKFLOW_KEY.format(chat_id))
        await r.aclose()
        if wf_id:
            return await db.get(Workflow, UUID(wf_id))
    except Exception:
        pass
    return None


async def _show_workflow_menu(chat_id: str, db: AsyncSession, intro: str | None = None) -> None:
    """Send the workflow selection menu as inline keyboard buttons."""
    token = get_settings().telegram_bot_token
    if not token:
        return
    workflows = await _get_telegram_workflows(db)
    if not workflows:
        await send_telegram_reply(
            chat_id,
            "⚠️ No workflows are available yet. Ask the AgentMesh admin to create one.",
        )
        return

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton(f"▶ {wf.name}", callback_data=f"select_wf:{wf.id}")]
        for wf in workflows
    ])
    text = intro or (
        "👋 *Welcome to AgentMesh!*\n\n"
        "I can run AI workflows for you. Please choose one to get started:"
    )
    await Bot(token=token).send_message(
        chat_id=chat_id, text=text, reply_markup=keyboard, parse_mode="Markdown"
    )


async def _handle_callback_query(update: Update, db: AsyncSession) -> None:
    """Handle inline button taps (workflow selection)."""
    cq = update.callback_query
    if not cq or not cq.data:
        return
    await cq.answer()

    chat_id = str(cq.message.chat.id)

    if cq.data.startswith("select_wf:"):
        wf_id = cq.data.split(":", 1)[1]

        # Verify workflow still exists
        workflow = await db.get(Workflow, UUID(wf_id))
        if not workflow:
            await cq.edit_message_text("❌ That workflow no longer exists. Use /workflows to see current options.")
            return

        # Store user's selection in Redis
        r = await _get_redis()
        await r.set(_USER_WORKFLOW_KEY.format(chat_id), wf_id)
        await r.set(_USER_WORKFLOW_NAME_KEY.format(chat_id), workflow.name)
        await r.aclose()

        await cq.edit_message_text(
            f"✅ *Connected to: {workflow.name}*\n\n"
            f"You're all set! Send me any message and I'll run this workflow for you.\n\n"
            f"_Use /workflows to switch to a different workflow._",
            parse_mode="Markdown",
        )


@router.post("/webhook/telegram")
async def telegram_webhook(
    request: Request, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)
):
    token = get_settings().telegram_bot_token
    if not token:
        return {"ok": True, "ignored": True}

    body = await request.json()
    update = Update.de_json(body, Bot(token=token))

    # Handle inline button taps (workflow selection)
    if update.callback_query:
        await _handle_callback_query(update, db)
        return {"ok": True}

    message = update.effective_message
    if not message or not update.effective_chat:
        return {"ok": True, "ignored": True}

    chat_id = str(update.effective_chat.id)
    text = (message.text or "").strip()

    # Handle bot commands
    if text.startswith("/start"):
        first_name = update.effective_user.first_name if update.effective_user else "there"
        await _show_workflow_menu(
            chat_id, db,
            intro=f"👋 *Hello, {first_name}!*\n\nWelcome to AgentMesh. Choose a workflow to connect:"
        )
        return {"ok": True}

    if text.startswith("/workflows"):
        await _show_workflow_menu(chat_id, db, intro="🔄 *Available Workflows* — tap one to switch:")
        return {"ok": True}

    if text.startswith("/help"):
        await send_telegram_reply(
            chat_id,
            "🤖 *AgentMesh Bot Help*\n\n"
            "/start — Connect to a workflow\n"
            "/workflows — Switch to a different workflow\n"
            "/help — Show this help\n\n"
            "Once connected, just send any message and your AI workflow will respond.",
            parse_mode="Markdown",
        )
        return {"ok": True}

    # Regular message — run the user's selected workflow
    if text.startswith("/"):
        # Unknown command
        await send_telegram_reply(chat_id, "Unknown command. Use /help for available commands.")
        return {"ok": True}

    workflow = await _get_user_workflow(chat_id, db)
    if not workflow:
        # No workflow selected yet — show menu
        await _show_workflow_menu(
            chat_id, db,
            intro="Please select a workflow first:"
        )
        return {"ok": True}

    # Create execution and run
    execution = Execution(
        workflow_id=workflow.id,
        trigger_channel="telegram",
        trigger_input=text,
        status="pending",
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Send acknowledgement first so user sees it immediately
    background_tasks.add_task(send_telegram_reply, chat_id, "⏳ Processing your request...")
    background_tasks.add_task(
        execute_workflow, str(workflow.id), text, "telegram", str(execution.id), chat_id
    )
    return {"ok": True, "execution_id": str(execution.id)}


@router.post("/api/settings/telegram/register")
async def register_telegram_webhook(webhook_url: str):
    token = get_settings().telegram_bot_token
    if not token:
        raise HTTPException(status_code=400, detail="TELEGRAM_BOT_TOKEN is not configured")
    result = await Bot(token=token).set_webhook(webhook_url)
    return {"ok": bool(result), "webhook_url": webhook_url}


@router.get("/api/settings/telegram/status")
async def telegram_status():
    settings = get_settings()
    bot_username: str | None = None
    if settings.telegram_bot_token:
        try:
            me = await Bot(token=settings.telegram_bot_token).get_me()
            bot_username = me.username
        except Exception:
            pass
    return {
        "token_configured": bool(settings.telegram_bot_token),
        "bot_username": bot_username,
        "public_base_url": settings.public_base_url,
    }
