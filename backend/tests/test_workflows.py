import pytest

valid_graph = {
    "nodes": [{"id": "start", "type": "start"}, {"id": "end", "type": "end"}],
    "edges": [{"id": "e1", "source": "start", "target": "end"}],
}


@pytest.mark.anyio
async def test_create_workflow(client):
    r = await client.post(
        "/api/workflows",
        json={
            "name": "Flow",
            "description": "",
            "graph_definition": valid_graph,
            "is_template": False,
        },
    )
    assert r.status_code == 201
    assert r.json()["graph_definition"]["nodes"][0]["id"] == "start"


@pytest.mark.anyio
async def test_template_loading(client):
    await client.post(
        "/api/workflows",
        json={
            "name": "Template A",
            "description": "",
            "graph_definition": valid_graph,
            "is_template": True,
        },
    )
    await client.post(
        "/api/workflows",
        json={
            "name": "Template B",
            "description": "",
            "graph_definition": valid_graph,
            "is_template": True,
        },
    )
    r = await client.get("/api/workflows/templates")
    assert r.status_code == 200
    assert len(r.json()) == 2


@pytest.mark.anyio
async def test_invalid_graph(client):
    graph = {
        "nodes": [{"id": "a", "type": "condition"}, {"id": "b", "type": "condition"}],
        "edges": [
            {"id": "e1", "source": "a", "target": "b"},
            {"id": "e2", "source": "b", "target": "a"},
        ],
    }
    r = await client.post(
        "/api/workflows",
        json={"name": "Bad", "description": "", "graph_definition": graph, "is_template": False},
    )
    assert r.status_code == 422
