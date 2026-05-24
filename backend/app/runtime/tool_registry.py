from __future__ import annotations

import asyncio
import os
import subprocess
from pathlib import Path
from typing import Any
import httpx
from duckduckgo_search import DDGS
from langchain_core.tools import StructuredTool, tool
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
from telegram import Bot
from app.config import get_settings
from app.queue.producer import publish_event

settings = get_settings()
WORKSPACE = Path(settings.workspace_dir).resolve()
WORKSPACE.mkdir(parents=True, exist_ok=True)


@tool
def web_search(query: str) -> str:
    """Search the web with DuckDuckGo and return concise result snippets."""
    with DDGS() as ddgs:
        results = list(ddgs.text(query, max_results=5))
    return "\n".join(f"{r.get('title')}: {r.get('href')} - {r.get('body')}" for r in results)


class HttpRequestArgs(BaseModel):
    url: str
    method: str = "GET"
    body: str = ""


def _http_request(url: str, method: str = "GET", body: str = "") -> str:
    response = httpx.request(method.upper(), url, content=body or None, timeout=20)
    response.raise_for_status()
    return response.text[:8000]


http_request = StructuredTool.from_function(
    func=_http_request,
    name="http_request",
    description="Make a real HTTP request. Args: url, method, body.",
    args_schema=HttpRequestArgs,
)


class TelegramArgs(BaseModel):
    chat_id: str
    message: str


async def _send_telegram_message(chat_id: str, message: str) -> str:
    token = settings.telegram_bot_token
    if not token:
        raise RuntimeError("TELEGRAM_BOT_TOKEN is not configured")
    bot = Bot(token=token)
    await bot.send_message(chat_id=chat_id, text=message)
    return "sent"


def _send_telegram_sync(chat_id: str, message: str) -> str:
    return asyncio.run(_send_telegram_message(chat_id, message))


send_telegram_message = StructuredTool.from_function(
    func=_send_telegram_sync,
    name="send_telegram_message",
    description="Send a Telegram message to a chat id.",
    args_schema=TelegramArgs,
)


def _safe_path(path: str) -> Path:
    candidate = (WORKSPACE / path.lstrip("/")).resolve()
    if not str(candidate).startswith(str(WORKSPACE)):
        raise ValueError("path must stay inside /workspace")
    return candidate


@tool
def read_file(path: str) -> str:
    """Read a UTF-8 text file from /workspace."""
    return _safe_path(path).read_text(encoding="utf-8")


class WriteFileArgs(BaseModel):
    path: str
    content: str


def _write_file(path: str, content: str) -> str:
    target = _safe_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return str(target)


write_file = StructuredTool.from_function(
    func=_write_file,
    name="write_file",
    description="Write a UTF-8 text file into /workspace.",
    args_schema=WriteFileArgs,
)


@tool
def python_repl(code: str) -> str:
    """Execute Python code in a restricted subprocess and return stdout/stderr."""
    env = {"PYTHONPATH": "", "PATH": os.environ.get("PATH", "")}
    proc = subprocess.run(
        ["python", "-I", "-c", code],
        capture_output=True,
        text=True,
        timeout=10,
        env=env,
        cwd=str(WORKSPACE),
    )
    output = (proc.stdout + proc.stderr).strip()
    if proc.returncode != 0:
        raise RuntimeError(output or f"python exited with {proc.returncode}")
    return output


@tool
def summarize_text(text: str) -> str:
    """Summarize text using the configured OpenAI model."""
    llm = ChatOpenAI(model="gpt-4o-mini", api_key=settings.openai_api_key)
    return llm.invoke(f"Summarize the following text clearly:\n\n{text}").content


class DelegateArgs(BaseModel):
    agent_id: str = Field(description="Target agent UUID")
    message: str


async def delegate_to_agent_async(
    agent_id: str, message: str, execution_id: str | None = None, from_agent: str | None = None
) -> str:
    event = {
        "type": "inter_agent_message",
        "agent_id": agent_id,
        "content": message,
        "metadata": {"from_agent": from_agent, "to_agent": agent_id},
    }
    if execution_id:
        await publish_event(f"execution:{execution_id}:logs", event)
    return "delegated"


def _delegate_to_agent(agent_id: str, message: str) -> str:
    return asyncio.run(delegate_to_agent_async(agent_id, message))


delegate_to_agent = StructuredTool.from_function(
    func=_delegate_to_agent,
    name="delegate_to_agent",
    description="Route a message to another agent by id.",
    args_schema=DelegateArgs,
)

AVAILABLE_TOOLS: dict[str, Any] = {
    "web_search": web_search,
    "http_request": http_request,
    "send_telegram_message": send_telegram_message,
    "read_file": read_file,
    "write_file": write_file,
    "python_repl": python_repl,
    "summarize_text": summarize_text,
    "delegate_to_agent": delegate_to_agent,
}


def get_tools(tool_names: list[str]) -> list[Any]:
    return [AVAILABLE_TOOLS[name] for name in tool_names if name in AVAILABLE_TOOLS]
