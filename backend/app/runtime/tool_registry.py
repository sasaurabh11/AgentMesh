from __future__ import annotations

import asyncio
import base64
import os
import smtplib
import subprocess
import time
import xml.etree.ElementTree as ET
from asyncio import AbstractEventLoop
from contextvars import ContextVar
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from html.parser import HTMLParser
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


# ---------------------------------------------------------------------------
# Web Search
# ---------------------------------------------------------------------------

@tool
def web_search(query: str) -> str:
    """Search the web and return concise result snippets."""
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


# ---------------------------------------------------------------------------
# HTTP Request
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# File I/O
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Python REPL
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Summarize Text
# ---------------------------------------------------------------------------

@tool
def summarize_text(text: str) -> str:
    """Summarize text using the configured OpenAI model."""
    llm = build_chat_model(settings.default_summary_model)
    return llm.invoke(f"Summarize the following text clearly:\n\n{text}").content


# ---------------------------------------------------------------------------
# Delegate to Agent
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Human Input
# ---------------------------------------------------------------------------

class HumanInputArgs(BaseModel):
    question: str = Field(description="The question to ask the user")


def _request_human_input(question: str) -> str:
    exec_id = _current_execution_id.get()
    loop = _current_event_loop.get()
    if not exec_id or loop is None:
        raise RuntimeError("request_human_input can only be used inside a workflow execution")

    from app.runtime.human_input import publish_waiting, poll_input_sync

    asyncio.run_coroutine_threadsafe(publish_waiting(exec_id, question), loop).result(timeout=30)
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


# ===========================================================================
# NEW TOOLS
# ===========================================================================

# ---------------------------------------------------------------------------
# 1. Extract Webpage — scrape clean readable text from any URL
# ---------------------------------------------------------------------------

class _HTMLStripper(HTMLParser):
    """Minimal HTML → plain-text converter using the stdlib parser."""
    _SKIP = {"script", "style", "head", "nav", "footer", "aside", "noscript"}

    def __init__(self) -> None:
        super().__init__()
        self._depth = 0
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list) -> None:
        if tag in self._SKIP:
            self._depth += 1

    def handle_endtag(self, tag: str) -> None:
        if tag in self._SKIP:
            self._depth = max(0, self._depth - 1)

    def handle_data(self, data: str) -> None:
        if not self._depth:
            text = data.strip()
            if text:
                self.parts.append(text)

    def get_text(self) -> str:
        return "\n".join(self.parts)


@tool
def extract_webpage(url: str) -> str:
    """Fetch a URL and return its readable text content (HTML stripped). Ideal for reading articles, docs, and pages."""
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AgentBot/1.0)"}
    resp = httpx.get(url, headers=headers, timeout=20, follow_redirects=True)
    resp.raise_for_status()
    stripper = _HTMLStripper()
    stripper.feed(resp.text)
    text = stripper.get_text()
    if not text.strip():
        return resp.text[:6000]
    return text[:8000]


# ---------------------------------------------------------------------------
# 2. Get Datetime — current date/time info
# ---------------------------------------------------------------------------

@tool
def get_datetime(timezone_name: str = "UTC") -> str:
    """Return the current date and time. Provide a timezone name like 'UTC', 'US/Eastern', 'Asia/Dubai'. Defaults to UTC."""
    try:
        import zoneinfo
        tz = zoneinfo.ZoneInfo(timezone_name)
        now = datetime.now(tz)
    except Exception:
        now = datetime.now(timezone.utc)

    return (
        f"Current date/time ({now.tzname()}):\n"
        f"  ISO 8601  : {now.isoformat()}\n"
        f"  Readable  : {now.strftime('%A, %B %d, %Y at %I:%M %p %Z')}\n"
        f"  Date only : {now.strftime('%Y-%m-%d')}\n"
        f"  Time only : {now.strftime('%H:%M:%S')}\n"
        f"  Unix stamp: {int(now.timestamp())}"
    )


# ---------------------------------------------------------------------------
# 3. List Files — browse the /workspace directory
# ---------------------------------------------------------------------------

class ListFilesArgs(BaseModel):
    directory: str = Field(default="", description="Sub-directory inside /workspace to list. Leave blank for root.")


def _list_files(directory: str = "") -> str:
    target = _safe_path(directory) if directory.strip() else WORKSPACE
    if not target.exists():
        return f"Directory does not exist: {directory}"
    entries = sorted(target.iterdir(), key=lambda p: (p.is_file(), p.name.lower()))
    if not entries:
        return "Empty directory."
    lines = []
    for p in entries:
        if p.is_dir():
            lines.append(f"[DIR]  {p.name}/")
        else:
            size = p.stat().st_size
            lines.append(f"[FILE] {p.name}  ({size:,} bytes)")
    return "\n".join(lines)


list_files = StructuredTool.from_function(
    func=_list_files,
    name="list_files",
    description="List files and folders inside /workspace (or a sub-directory). Use this to see what files are available before reading them.",
    args_schema=ListFilesArgs,
)


# ---------------------------------------------------------------------------
# 4. RSS Reader — fetch and parse an RSS/Atom feed
# ---------------------------------------------------------------------------

class RssReaderArgs(BaseModel):
    url: str = Field(description="URL of the RSS or Atom feed")
    max_items: int = Field(default=8, ge=1, le=20, description="Maximum number of articles to return")


def _rss_reader(url: str, max_items: int = 8) -> str:
    headers = {"User-Agent": "Mozilla/5.0 (compatible; AgentBot/1.0)"}
    resp = httpx.get(url, headers=headers, timeout=20, follow_redirects=True)
    resp.raise_for_status()

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        return f"Failed to parse feed XML: {e}"

    items: list[dict] = []

    # RSS 2.0
    for item in root.iter("item"):
        title = item.findtext("title", "").strip()
        link = item.findtext("link", "").strip()
        desc = item.findtext("description", "").strip()[:300]
        pub = item.findtext("pubDate", "").strip()
        items.append({"title": title, "link": link, "description": desc, "date": pub})
        if len(items) >= max_items:
            break

    # Atom
    if not items:
        atom_ns = "http://www.w3.org/2005/Atom"
        for entry in root.iter(f"{{{atom_ns}}}entry"):
            title = entry.findtext(f"{{{atom_ns}}}title", "").strip()
            link_el = entry.find(f"{{{atom_ns}}}link")
            link = link_el.get("href", "") if link_el is not None else ""
            summary = entry.findtext(f"{{{atom_ns}}}summary", "").strip()[:300]
            updated = entry.findtext(f"{{{atom_ns}}}updated", "").strip()
            items.append({"title": title, "link": link, "description": summary, "date": updated})
            if len(items) >= max_items:
                break

    if not items:
        return "No items found in the feed."

    lines = [f"Feed: {url}\n"]
    for i, it in enumerate(items, 1):
        lines.append(
            f"{i}. {it['title']}\n"
            f"   Link: {it['link']}\n"
            f"   Date: {it['date']}\n"
            f"   {it['description']}"
        )
    return "\n\n".join(lines)


rss_reader = StructuredTool.from_function(
    func=_rss_reader,
    name="rss_reader",
    description="Fetch and parse an RSS or Atom feed URL. Returns recent article titles, links, dates, and summaries. Useful for monitoring news or blogs.",
    args_schema=RssReaderArgs,
)


# ---------------------------------------------------------------------------
# 5. Send Email — send an email via SMTP
# ---------------------------------------------------------------------------

class SendEmailArgs(BaseModel):
    to: str = Field(description="Recipient email address (or comma-separated list)")
    subject: str = Field(description="Email subject line")
    body: str = Field(description="Plain-text email body")


def _send_email(to: str, subject: str, body: str) -> str:
    host = settings.smtp_host
    if not host:
        return (
            "SMTP is not configured. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD "
            "to your .env file to enable email sending."
        )

    msg = MIMEMultipart()
    msg["From"] = settings.smtp_from or settings.smtp_user
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(host, settings.smtp_port, timeout=15) as smtp:
            smtp.ehlo()
            if settings.smtp_use_tls:
                smtp.starttls()
                smtp.ehlo()
            if settings.smtp_user and settings.smtp_password:
                smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.sendmail(msg["From"], [addr.strip() for addr in to.split(",")], msg.as_string())
        return f"Email sent successfully to {to}."
    except Exception as e:
        return f"Failed to send email: {e}"


send_email = StructuredTool.from_function(
    func=_send_email,
    name="send_email",
    description=(
        "Send an email. Requires SMTP_HOST to be configured in .env. "
        "Args: to (recipient address), subject, body (plain text)."
    ),
    args_schema=SendEmailArgs,
)


# ---------------------------------------------------------------------------
# 6. Save Note — persist a named note to Redis
# ---------------------------------------------------------------------------

class SaveNoteArgs(BaseModel):
    key: str = Field(description="Short name/key for this note (e.g. 'research_summary')")
    value: str = Field(description="Content to store")


def _save_note(key: str, value: str) -> str:
    import redis as redis_lib
    r = redis_lib.from_url(settings.redis_url, decode_responses=True)
    redis_key = f"agent:note:{key.strip()}"
    r.set(redis_key, value, ex=86400 * 7)  # expires in 7 days
    return f"Note '{key}' saved ({len(value)} chars). Expires in 7 days."


save_note = StructuredTool.from_function(
    func=_save_note,
    name="save_note",
    description=(
        "Save a named note or piece of information to persistent storage (Redis). "
        "Use this to remember facts, results, or context across agent runs. "
        "Notes expire after 7 days."
    ),
    args_schema=SaveNoteArgs,
)


# ---------------------------------------------------------------------------
# 7. Get Note — retrieve a previously saved note from Redis
# ---------------------------------------------------------------------------

class GetNoteArgs(BaseModel):
    key: str = Field(description="The key/name of the note to retrieve")


def _get_note(key: str) -> str:
    import redis as redis_lib
    r = redis_lib.from_url(settings.redis_url, decode_responses=True)
    redis_key = f"agent:note:{key.strip()}"
    value = r.get(redis_key)
    if value is None:
        ttl = r.ttl(redis_key)
        return f"No note found for key '{key}'."
    ttl = r.ttl(redis_key)
    days_left = ttl // 86400 if ttl > 0 else "unknown"
    return f"Note '{key}' (expires in ~{days_left} day(s)):\n\n{value}"


get_note = StructuredTool.from_function(
    func=_get_note,
    name="get_note",
    description=(
        "Retrieve a previously saved note by its key name. "
        "Use save_note first to store information, then get_note to recall it later."
    ),
    args_schema=GetNoteArgs,
)


# ---------------------------------------------------------------------------
# 8. Analyze Image — describe or answer questions about an image URL
# ---------------------------------------------------------------------------

class AnalyzeImageArgs(BaseModel):
    image_url: str = Field(description="Public URL of the image to analyze")
    question: str = Field(
        default="Describe this image in detail.",
        description="What to ask about the image (e.g. 'What text is visible?', 'List all objects.')"
    )


def _analyze_image(image_url: str, question: str = "Describe this image in detail.") -> str:
    # Fetch and encode the image as base64 so it works with any vision model
    try:
        resp = httpx.get(image_url, timeout=30, follow_redirects=True)
        resp.raise_for_status()
        content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        image_b64 = base64.b64encode(resp.content).decode()
        data_url = f"data:{content_type};base64,{image_b64}"
    except Exception as e:
        return f"Failed to fetch image: {e}"

    try:
        llm = build_chat_model(settings.default_summary_model)
        msg = HumanMessage(content=[
            {"type": "image_url", "image_url": {"url": data_url}},
            {"type": "text", "text": question},
        ])
        result = llm.invoke([msg])
        return str(result.content)
    except Exception as e:
        return (
            f"Image analysis failed: {e}\n"
            "Note: ensure your DEFAULT_SUMMARY_MODEL supports vision (e.g. gpt-4o, gemini-2.0-flash, claude-sonnet-4-6)."
        )


analyze_image = StructuredTool.from_function(
    func=_analyze_image,
    name="analyze_image",
    description=(
        "Analyze or describe an image from a public URL using a vision-capable AI model. "
        "Can answer specific questions about image content, extract text (OCR), or describe scenes."
    ),
    args_schema=AnalyzeImageArgs,
)


# ===========================================================================
# Registry
# ===========================================================================

AVAILABLE_TOOLS: dict[str, Any] = {
    # Existing
    "web_search": web_search,
    "http_request": http_request,
    "send_telegram_message": send_telegram_message,
    "read_file": read_file,
    "write_file": write_file,
    "python_repl": python_repl,
    "summarize_text": summarize_text,
    "delegate_to_agent": delegate_to_agent,
    "request_human_input": request_human_input,
    # New
    "extract_webpage": extract_webpage,
    "get_datetime": get_datetime,
    "list_files": list_files,
    "rss_reader": rss_reader,
    "send_email": send_email,
    "save_note": save_note,
    "get_note": get_note,
    "analyze_image": analyze_image,
}


def get_tools(tool_names: list[str]) -> list[Any]:
    return [AVAILABLE_TOOLS[name] for name in tool_names if name in AVAILABLE_TOOLS]
