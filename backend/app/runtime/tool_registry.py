from __future__ import annotations

import asyncio
import os
import subprocess
import time
from asyncio import AbstractEventLoop
from contextvars import ContextVar
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID
import httpx
from duckduckgo_search import DDGS
from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import StructuredTool, tool
from pydantic import BaseModel, Field
from telegram import Bot
from app.config import get_settings
from app.queue.producer import publish_event
from app.runtime.llm_factory import build_chat_model

# Set by agent_node.py before each executor invocation so tools know which execution they're in.
_current_execution_id: ContextVar[str] = ContextVar("execution_id", default="")
# The running main event loop — tools use this to submit async work from their sync thread.
_current_event_loop: ContextVar[AbstractEventLoop | None] = ContextVar("event_loop", default=None)

settings = get_settings()
WORKSPACE = Path(settings.workspace_dir).resolve()
WORKSPACE.mkdir(parents=True, exist_ok=True)


@tool
def web_search(query: str) -> str:
    """Search the web and return concise result snippets."""
    # Use Tavily if API key is configured (reliable, no rate limits on free tier)
    if settings.tavily_api_key:
        try:
            from tavily import TavilyClient
            client = TavilyClient(api_key=settings.tavily_api_key)
            resp = client.search(query, max_results=5)
            results = resp.get("results", [])
            if not results:
                return f"No results found for: {query}"
            return "\n\n".join(
                f"Title: {r.get('title', 'N/A')}\nURL: {r.get('url', 'N/A')}\nSnippet: {r.get('content', 'N/A')}"
                for r in results
            )
        except Exception as e:
            return f"web_search (Tavily) failed: {e}"

    # Fallback: DuckDuckGo (may be rate-limited)
    from duckduckgo_search.exceptions import RatelimitException, DuckDuckGoSearchException
    last_err: Exception | None = None
    for backend in ("html", "lite", "api"):
        for attempt in range(2):
            try:
                with DDGS() as ddgs:
                    results = list(ddgs.text(query, max_results=5, backend=backend))
                if not results:
                    return f"No results found for: {query}"
                return "\n\n".join(
                    f"Title: {r.get('title', 'N/A')}\nURL: {r.get('href', 'N/A')}\nSnippet: {r.get('body', 'N/A')}"
                    for r in results
                )
            except RatelimitException as e:
                last_err = e
                time.sleep(3 * (attempt + 1))
            except DuckDuckGoSearchException as e:
                last_err = e
                break
    return (
        f"web_search failed — DuckDuckGo is rate limiting this IP.\n"
        f"Fix: add TAVILY_API_KEY=tvly-... to your .env file (free at https://app.tavily.com).\n"
        f"Error: {last_err}"
    )


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
    runner = (
        "import ast\n"
        "source = " + repr(code) + "\n"
        "tree = ast.parse(source, mode='exec')\n"
        "if len(tree.body) == 1 and isinstance(tree.body[0], ast.Expr):\n"
        "    result = eval(compile(ast.Expression(tree.body[0].value), '<agent-code>', 'eval'))\n"
        "    if result is not None:\n"
        "        print(result)\n"
        "else:\n"
        "    exec(compile(tree, '<agent-code>', 'exec'))\n"
    )
    env = {"PYTHONPATH": "", "PATH": os.environ.get("PATH", "")}
    proc = subprocess.run(
        ["python", "-I", "-c", runner],
        capture_output=True,
        text=True,
        timeout=10,
        env=env,
        cwd=str(WORKSPACE),
    )
    if proc.returncode != 0:
        output = (proc.stdout + proc.stderr).strip()
        raise RuntimeError(output or f"python exited with {proc.returncode}")
    return proc.stdout.strip() or "ok"


@tool
def summarize_text(text: str) -> str:
    """Summarize text using the configured OpenAI model."""
    llm = build_chat_model(settings.default_summary_model)
    return llm.invoke(f"Summarize the following text clearly:\n\n{text}").content


class DelegateArgs(BaseModel):
    agent_id: str = Field(description="Target agent UUID")
    message: str = Field(description="Task or question for the target agent")


async def _delegate_async(agent_id: str, message: str) -> str:
    from app.database import AsyncSessionLocal
    from app.models.agent import Agent as AgentModel

    exec_id = _current_execution_id.get()

    async with AsyncSessionLocal() as db:
        agent = await db.get(AgentModel, UUID(agent_id))
        if not agent:
            return f"Error: agent {agent_id} not found"

    llm = build_chat_model(agent.model)
    msgs = [SystemMessage(content=agent.system_prompt), HumanMessage(content=message)]
    result = await llm.ainvoke(msgs)
    output = str(result.content)

    if exec_id:
        await publish_event(
            f"execution:{exec_id}:logs",
            {
                "type": "inter_agent_message",
                "agent_id": agent_id,
                "content": output,
                "metadata": {"agent_name": agent.name, "task": message},
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )
    return output


def _delegate_to_agent(agent_id: str, message: str) -> str:
    loop = _current_event_loop.get()
    if loop is None:
        raise RuntimeError("delegate_to_agent must be used inside a workflow execution")
    future = asyncio.run_coroutine_threadsafe(_delegate_async(agent_id, message), loop)
    return future.result(timeout=120)


delegate_to_agent = StructuredTool.from_function(
    func=_delegate_to_agent,
    name="delegate_to_agent",
    description=(
        "Delegate a task to a specialist agent and get their response. "
        "Provide the agent's UUID and a clear task description."
    ),
    args_schema=DelegateArgs,
)


class HumanInputArgs(BaseModel):
    question: str = Field(description="The question to ask the user")


def _request_human_input(question: str) -> str:
    """
    Synchronous tool function that runs in a thread-pool thread.
    Publishes the waiting_for_input event on the main event loop, then blocks
    this thread with a synchronous Redis poll (no event-loop conflicts).
    """
    exec_id = _current_execution_id.get()
    loop = _current_event_loop.get()
    if not exec_id or loop is None:
        raise RuntimeError("request_human_input can only be used inside a workflow execution")

    from app.runtime.human_input import publish_waiting, poll_input_sync

    # Publish the event on the main event loop (async-safe from a thread)
    asyncio.run_coroutine_threadsafe(publish_waiting(exec_id, question), loop).result(timeout=30)

    # Block this thread with a plain sync poll — no event loop needed
    return poll_input_sync(exec_id, timeout=300)


request_human_input = StructuredTool.from_function(
    func=_request_human_input,
    name="request_human_input",
    description=(
        "Ask the user a question and wait for their response. "
        "Use this when you need clarification or additional information before proceeding."
    ),
    args_schema=HumanInputArgs,
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
    "request_human_input": request_human_input,
}


def get_tools(tool_names: list[str]) -> list[Any]:
    return [AVAILABLE_TOOLS[name] for name in tool_names if name in AVAILABLE_TOOLS]
