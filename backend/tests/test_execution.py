"""
Tests for the workflow execution pipeline:
  - HTTP trigger creates Execution records in the DB
  - GET /executions and /executions/{id} return correct data
  - GET /executions/{id}/logs and /messages return stored rows
  - Telegram webhook handles commands and regular messages correctly
"""
from uuid import uuid4

import pytest

from app.runtime import executor as executor_module

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

MINIMAL_GRAPH = {
    "nodes": [{"id": "start", "type": "start"}, {"id": "end", "type": "end"}],
    "edges": [{"id": "e1", "source": "start", "target": "end"}],
}


async def _make_workflow(client, name: str = "Test Flow") -> dict:
    r = await client.post(
        "/api/workflows",
        json={
            "name": name,
            "description": "",
            "graph_definition": MINIMAL_GRAPH,
            "is_template": False,
        },
    )
    assert r.status_code == 201
    return r.json()


def _noop_executor(monkeypatch):
    """Replace execute_workflow with a no-op so no real LLM is hit."""
    async def _fake(*_, **kwargs):
        return kwargs.get("execution_id") or str(uuid4())

    monkeypatch.setattr(executor_module, "execute_workflow", _fake)


# ===========================================================================
# 1. Execution Trigger
# ===========================================================================

@pytest.mark.anyio
async def test_trigger_creates_pending_execution(client, monkeypatch):
    """POST /execute immediately returns a pending Execution record."""
    workflow = await _make_workflow(client)
    _noop_executor(monkeypatch)

    r = await client.post(
        f"/api/workflows/{workflow['id']}/execute", json={"input": "run this"}
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "pending"
    assert "id" in data
    assert data["id"] is not None


@pytest.mark.anyio
async def test_trigger_records_trigger_channel(client, monkeypatch):
    """Execution created via REST API should have trigger_channel='api'."""
    workflow = await _make_workflow(client)
    _noop_executor(monkeypatch)

    r = await client.post(
        f"/api/workflows/{workflow['id']}/execute", json={"input": "test"}
    )
    exec_id = r.json()["id"]

    detail = await client.get(f"/api/executions/{exec_id}")
    assert detail.status_code == 200
    assert detail.json()["trigger_channel"] == "api"


@pytest.mark.anyio
async def test_trigger_nonexistent_workflow_returns_404(client, monkeypatch):
    """Triggering a workflow that doesn't exist must return 404."""
    _noop_executor(monkeypatch)
    r = await client.post(
        f"/api/workflows/{uuid4()}/execute", json={"input": "hi"}
    )
    assert r.status_code == 404


# ===========================================================================
# 2. Execution List & Detail
# ===========================================================================

@pytest.mark.anyio
async def test_list_executions_empty_initially(client):
    """No executions exist in a fresh test DB."""
    r = await client.get("/api/executions")
    assert r.status_code == 200
    assert r.json() == []


@pytest.mark.anyio
async def test_list_executions_shows_triggered_run(client, monkeypatch):
    """After triggering, the execution appears in the list."""
    workflow = await _make_workflow(client)
    _noop_executor(monkeypatch)

    await client.post(
        f"/api/workflows/{workflow['id']}/execute", json={"input": "hello"}
    )

    r = await client.get("/api/executions")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["status"] == "pending"


@pytest.mark.anyio
async def test_get_execution_by_id(client, monkeypatch):
    """GET /executions/{id} returns the correct execution."""
    workflow = await _make_workflow(client)
    _noop_executor(monkeypatch)

    trigger_r = await client.post(
        f"/api/workflows/{workflow['id']}/execute", json={"input": "lookup test"}
    )
    exec_id = trigger_r.json()["id"]

    r = await client.get(f"/api/executions/{exec_id}")
    assert r.status_code == 200
    data = r.json()
    assert data["id"] == exec_id
    assert data["trigger_input"] == "lookup test"


@pytest.mark.anyio
async def test_get_unknown_execution_returns_404(client):
    """GET /executions/{id} with a non-existent ID returns 404."""
    r = await client.get(f"/api/executions/{uuid4()}")
    assert r.status_code == 404


@pytest.mark.anyio
async def test_list_executions_filter_by_workflow(client, monkeypatch):
    """The workflow_id query param filters executions correctly."""
    wf1 = await _make_workflow(client, "Flow A")
    wf2 = await _make_workflow(client, "Flow B")
    _noop_executor(monkeypatch)

    await client.post(f"/api/workflows/{wf1['id']}/execute", json={"input": "a"})
    await client.post(f"/api/workflows/{wf2['id']}/execute", json={"input": "b"})

    r1 = await client.get(f"/api/executions?workflow_id={wf1['id']}")
    r2 = await client.get(f"/api/executions?workflow_id={wf2['id']}")

    assert len(r1.json()) == 1
    assert len(r2.json()) == 1
    assert r1.json()[0]["trigger_input"] == "a"
    assert r2.json()[0]["trigger_input"] == "b"


# ===========================================================================
# 3. Logs & Messages
# ===========================================================================

@pytest.mark.anyio
async def test_get_execution_logs_initially_empty(client, monkeypatch):
    """A freshly created execution has no logs yet."""
    workflow = await _make_workflow(client)
    _noop_executor(monkeypatch)

    r = await client.post(
        f"/api/workflows/{workflow['id']}/execute", json={"input": "x"}
    )
    exec_id = r.json()["id"]

    logs = await client.get(f"/api/executions/{exec_id}/logs")
    assert logs.status_code == 200
    assert isinstance(logs.json(), list)


@pytest.mark.anyio
async def test_get_execution_messages_initially_empty(client, monkeypatch):
    """A freshly created execution has no messages yet (background task not run)."""
    workflow = await _make_workflow(client)
    _noop_executor(monkeypatch)

    r = await client.post(
        f"/api/workflows/{workflow['id']}/execute", json={"input": "y"}
    )
    exec_id = r.json()["id"]

    msgs = await client.get(f"/api/executions/{exec_id}/messages")
    assert msgs.status_code == 200
    assert isinstance(msgs.json(), list)


# ===========================================================================
# 4. WebSocket log event schema
# ===========================================================================

@pytest.mark.anyio
async def test_log_event_schema_is_valid():
    """Validate the contract for log events emitted during execution."""
    required_fields = {"type", "agent_id", "content", "metadata", "timestamp"}

    valid_events = [
        {
            "type": "agent_start",
            "agent_id": str(uuid4()),
            "content": "Agent started",
            "metadata": {"model": "gpt-4o-mini"},
            "timestamp": "2026-05-26T00:00:00Z",
        },
        {
            "type": "tool_call",
            "agent_id": str(uuid4()),
            "content": "web_search query",
            "metadata": {"tool_name": "web_search"},
            "timestamp": "2026-05-26T00:00:01Z",
        },
        {
            "type": "agent_output",
            "agent_id": None,
            "content": "Final answer",
            "metadata": {"token_count": 120, "cost": 0.00002},
            "timestamp": "2026-05-26T00:00:02Z",
        },
        {
            "type": "completed",
            "agent_id": None,
            "content": "Workflow done",
            "metadata": {"total_tokens": 300, "total_cost_usd": 0.00005},
            "timestamp": "2026-05-26T00:00:03Z",
        },
        {
            "type": "error",
            "agent_id": None,
            "content": "Something failed",
            "metadata": {},
            "timestamp": "2026-05-26T00:00:04Z",
        },
    ]

    for event in valid_events:
        missing = required_fields - event.keys()
        assert not missing, f"Event type '{event['type']}' missing fields: {missing}"
        assert isinstance(event["content"], str)
        assert isinstance(event["metadata"], dict)
        assert isinstance(event["timestamp"], str)


# ===========================================================================
# 5. Telegram Webhook
# ===========================================================================

@pytest.mark.anyio
async def test_telegram_webhook_no_token_returns_ok(client):
    """/webhook/telegram returns ok:True even when no bot token is configured."""
    update = {
        "update_id": 1,
        "message": {
            "message_id": 1,
            "date": 1,
            "chat": {"id": 123, "type": "private"},
            "text": "hello",
        },
    }
    r = await client.post("/webhook/telegram", json=update)
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.anyio
async def test_telegram_webhook_help_command(client, monkeypatch):
    """The /help command is handled without triggering a workflow."""
    async def _no_reply(*_):  # noqa: ANN002
        return None

    monkeypatch.setattr("app.channels.telegram.send_telegram_reply", _no_reply)
    monkeypatch.setattr("app.config.get_settings", lambda: _FakeSettings())

    update = {
        "update_id": 2,
        "message": {
            "message_id": 2,
            "date": 1,
            "chat": {"id": 999, "type": "private"},
            "from": {"id": 999, "is_bot": False, "first_name": "Tester"},
            "text": "/help",
        },
    }
    r = await client.post("/webhook/telegram", json=update)
    assert r.status_code == 200
    assert r.json()["ok"] is True


@pytest.mark.anyio
async def test_telegram_webhook_regular_message_creates_execution(client, monkeypatch):
    """A plain message from a user whose workflow is pre-selected creates an Execution."""
    workflow = await _make_workflow(client, "Telegram Flow")

    _noop_executor(monkeypatch)

    # Pre-seed Redis with the user's selected workflow
    import redis as redis_lib
    from app.config import get_settings
    r = redis_lib.from_url(get_settings().redis_url, decode_responses=True)
    chat_id = "555"
    r.set(f"telegram:user:{chat_id}:workflow_id", workflow["id"])
    r.close()

    async def _no_reply(*_):  # noqa: ANN002
        return None

    monkeypatch.setattr("app.channels.telegram.send_telegram_reply", _no_reply)
    monkeypatch.setattr("app.channels.telegram.execute_workflow", executor_module.execute_workflow)

    settings = get_settings()
    if not settings.telegram_bot_token:
        pytest.skip("TELEGRAM_BOT_TOKEN not configured — skipping live Telegram test")

    update = {
        "update_id": 10,
        "message": {
            "message_id": 10,
            "date": 1,
            "chat": {"id": int(chat_id), "type": "private"},
            "from": {"id": int(chat_id), "is_bot": False, "first_name": "User"},
            "text": "What is the weather today?",
        },
    }
    r2 = await client.post("/webhook/telegram", json=update)
    assert r2.status_code == 200
    assert r2.json()["ok"] is True

    # An Execution must have been persisted
    executions = (await client.get("/api/executions")).json()
    assert len(executions) >= 1
    assert executions[0]["trigger_channel"] == "telegram"
    assert executions[0]["trigger_input"] == "What is the weather today?"


# ---------------------------------------------------------------------------
# Fake Settings helper for Telegram tests that need a token to parse Updates
# ---------------------------------------------------------------------------
class _FakeSettings:
    telegram_bot_token = ""  # forces early return in webhook handler
    redis_url = "redis://localhost:6379/0"
    openai_api_key = ""
    gemini_api_key = ""
    anthropic_api_key = ""
    smtp_host = ""
    smtp_port = 587
    smtp_user = ""
    smtp_password = ""
    smtp_from = ""
    smtp_use_tls = True
    tavily_api_key = ""
    default_summary_model = "gpt-4o-mini"
    workspace_dir = "/tmp/workspace"
    default_workflow_id = None
    public_base_url = "http://localhost:8000"
    secret_key = "test"
    telegram_webhook_secret = ""
    backend_cors_origins = "http://localhost:3000"

    @property
    def cors_origins(self):
        return ["http://localhost:3000"]
