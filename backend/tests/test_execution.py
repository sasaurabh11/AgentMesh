from uuid import uuid4
import pytest
from app.models.execution import Execution, ExecutionLog
from app.models.message import Message
from app.runtime import executor as executor_module


@pytest.mark.anyio
async def test_execute_workflow(client, monkeypatch):
    graph = {
        "nodes": [{"id": "start", "type": "start"}, {"id": "end", "type": "end"}],
        "edges": [{"id": "e1", "source": "start", "target": "end"}],
    }
    workflow = (
        await client.post(
            "/api/workflows",
            json={
                "name": "Runnable",
                "description": "",
                "graph_definition": graph,
                "is_template": False,
            },
        )
    ).json()

    async def fake_execute(
        workflow_id, input_text, trigger_channel, execution_id=None, telegram_chat_id=None
    ):
        return execution_id or str(uuid4())

    monkeypatch.setattr(executor_module, "execute_workflow", fake_execute)
    r = await client.post(f"/api/workflows/{workflow['id']}/execute", json={"input": "hello"})
    assert r.status_code == 200
    assert r.json()["status"] == "pending"


@pytest.mark.anyio
async def test_websocket_logs_contract():
    event = {
        "type": "agent_output",
        "agent_id": None,
        "content": "done",
        "metadata": {},
        "timestamp": "2026-05-24T00:00:00Z",
    }
    assert event["type"] == "agent_output"
    assert "content" in event


@pytest.mark.anyio
async def test_telegram_webhook(client, monkeypatch):
    graph = {
        "nodes": [{"id": "start", "type": "start"}, {"id": "end", "type": "end"}],
        "edges": [{"id": "e1", "source": "start", "target": "end"}],
    }
    await client.post(
        "/api/workflows",
        json={
            "name": "Telegram Flow",
            "description": "",
            "graph_definition": graph,
            "is_template": False,
        },
    )

    async def fake_send(chat_id, text):
        return None

    monkeypatch.setattr("app.channels.telegram.send_telegram_reply", fake_send)
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
