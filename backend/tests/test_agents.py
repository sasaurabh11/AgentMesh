import pytest

payload = {
    "name": "Support Agent",
    "role": "Support",
    "system_prompt": "Answer clearly.",
    "model": "gpt-4o-mini",
    "tools": ["web_search"],
    "memory_enabled": False,
    "memory_config": {},
    "guardrails": {"max_tokens_per_run": 1000, "max_cost_usd": 0.2, "forbidden_topics": []},
    "schedule": None,
    "channel": None,
    "channel_config": {},
}


@pytest.mark.anyio
async def test_create_agent(client):
    r = await client.post("/api/agents", json=payload)
    assert r.status_code == 201
    assert r.json()["name"] == "Support Agent"


@pytest.mark.anyio
async def test_update_agent(client):
    created = (await client.post("/api/agents", json=payload)).json()
    r = await client.put(f"/api/agents/{created['id']}", json={"name": "Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"


@pytest.mark.anyio
async def test_delete_agent(client):
    created = (await client.post("/api/agents", json=payload)).json()
    r = await client.delete(f"/api/agents/{created['id']}")
    assert r.status_code == 204
    assert (await client.get(f"/api/agents/{created['id']}")).status_code == 404


@pytest.mark.anyio
async def test_agent_validation(client):
    r = await client.post("/api/agents", json={"name": "bad"})
    assert r.status_code == 422
