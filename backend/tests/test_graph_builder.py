"""
Unit tests for graph_builder.py.
Tests condition evaluation logic and graph compilation with minimal graphs
(no LLM calls required).
"""
import pytest
from app.runtime.graph_builder import _eval_condition


# ===========================================================================
# _eval_condition — condition expression evaluator
# ===========================================================================

def _state(agent_id: str, output: str) -> dict:
    """Helper: build a minimal OrchestrationState-like dict."""
    return {"agent_outputs": {agent_id: output}}


class TestEvalConditionContains:
    def test_contains_match_is_true(self):
        state = _state("agent-1", "The task is completed successfully")
        assert _eval_condition("agent_outputs['agent-1'] contains 'completed'", state) is True

    def test_contains_no_match_is_false(self):
        state = _state("agent-1", "The task failed")
        assert _eval_condition("agent_outputs['agent-1'] contains 'completed'", state) is False

    def test_contains_case_insensitive(self):
        state = _state("agent-1", "Status: COMPLETED")
        assert _eval_condition("agent_outputs['agent-1'] contains 'completed'", state) is True

    def test_contains_missing_agent_is_false(self):
        state = {"agent_outputs": {}}
        assert _eval_condition("agent_outputs['agent-1'] contains 'value'", state) is False

    def test_contains_with_double_quotes_in_expr(self):
        state = _state("agent-2", "result is good")
        assert _eval_condition('agent_outputs["agent-2"] contains "good"', state) is True

    def test_contains_partial_word(self):
        state = _state("a", "error occurred")
        assert _eval_condition("agent_outputs['a'] contains 'err'", state) is True


class TestEvalConditionEquals:
    def test_equals_exact_match(self):
        state = _state("agent-1", "yes")
        assert _eval_condition("agent_outputs['agent-1'] == 'yes'", state) is True

    def test_equals_mismatch(self):
        state = _state("agent-1", "no")
        assert _eval_condition("agent_outputs['agent-1'] == 'yes'", state) is False

    def test_equals_is_case_sensitive(self):
        state = _state("agent-1", "YES")
        # Equals is a strict match — case matters
        assert _eval_condition("agent_outputs['agent-1'] == 'yes'", state) is False

    def test_equals_missing_agent_is_false(self):
        state = {"agent_outputs": {}}
        assert _eval_condition("agent_outputs['agent-1'] == 'value'", state) is False

    def test_equals_with_spaces_in_output(self):
        # The evaluator strips the output before comparing
        state = _state("a", "  done  ")
        assert _eval_condition("agent_outputs['a'] == 'done'", state) is True


class TestEvalConditionQuality:
    def test_quality_good_when_output_contains_good(self):
        state = _state("reviewer", "The report quality = good, approved.")
        assert _eval_condition("quality = good", state) is True

    def test_quality_good_when_output_just_says_good(self):
        state = _state("reviewer", "This looks good overall.")
        assert _eval_condition("quality = good", state) is True

    def test_quality_good_false_when_no_good_in_output(self):
        state = _state("reviewer", "Needs significant revisions.")
        assert _eval_condition("quality = good", state) is False

    def test_quality_revise_when_output_contains_revise(self):
        state = _state("reviewer", "Please revise the introduction section.")
        assert _eval_condition("quality = revise", state) is True

    def test_quality_revise_false_when_no_revise(self):
        state = _state("reviewer", "Looks great!")
        assert _eval_condition("quality = revise", state) is False

    def test_quality_checks_all_agent_outputs(self):
        # Multiple agents in state — any output containing 'good' triggers true
        state = {
            "agent_outputs": {
                "agent-1": "Initial draft done.",
                "agent-2": "quality = good",
            }
        }
        assert _eval_condition("quality = good", state) is True


class TestEvalConditionEdgeCases:
    def test_empty_expression_is_false(self):
        state = _state("a", "anything")
        assert _eval_condition("", state) is False

    def test_none_expression_is_false(self):
        assert _eval_condition(None, {"agent_outputs": {}}) is False

    def test_literal_false_is_false(self):
        assert _eval_condition("false", {"agent_outputs": {}}) is False

    def test_literal_no_is_false(self):
        assert _eval_condition("no", {"agent_outputs": {}}) is False

    def test_literal_zero_is_false(self):
        assert _eval_condition("0", {"agent_outputs": {}}) is False

    def test_arbitrary_truthy_string_is_true(self):
        # Any non-empty expression not matching false/no/0 defaults to True
        assert _eval_condition("some-condition", {"agent_outputs": {}}) is True

    def test_whitespace_only_expression(self):
        assert _eval_condition("   ", {"agent_outputs": {}}) is False

    def test_empty_agent_outputs(self):
        state = {"agent_outputs": {}}
        assert _eval_condition("agent_outputs['x'] contains 'y'", state) is False


# ===========================================================================
# Build graph — structural compilation (no LLM / DB)
# ===========================================================================

@pytest.mark.anyio
async def test_build_graph_minimal_start_end(client):
    """A start→end workflow can be created and stored without errors."""
    r = await client.post(
        "/api/workflows",
        json={
            "name": "Minimal",
            "description": "",
            "graph_definition": {
                "nodes": [{"id": "start", "type": "start"}, {"id": "end", "type": "end"}],
                "edges": [{"id": "e1", "source": "start", "target": "end"}],
            },
            "is_template": False,
        },
    )
    assert r.status_code == 201
    data = r.json()
    assert data["graph_definition"]["nodes"][0]["id"] == "start"
    assert data["graph_definition"]["nodes"][1]["id"] == "end"


@pytest.mark.anyio
async def test_build_graph_with_condition_node(client):
    """A workflow with a condition node is persisted correctly."""
    r = await client.post(
        "/api/workflows",
        json={
            "name": "Branching Flow",
            "description": "",
            "graph_definition": {
                "nodes": [
                    {"id": "start", "type": "start"},
                    {
                        "id": "check",
                        "type": "condition",
                        "condition_expr": "agent_outputs['a'] contains 'ok'",
                    },
                    {"id": "end", "type": "end"},
                ],
                "edges": [
                    {"id": "e1", "source": "start", "target": "check"},
                    {"id": "e2", "source": "check", "target": "end", "label": "true"},
                    {"id": "e3", "source": "check", "target": "end", "label": "false"},
                ],
            },
            "is_template": False,
        },
    )
    assert r.status_code == 201


@pytest.mark.anyio
async def test_workflow_missing_start_node_is_invalid(client):
    """A graph with no start node should be rejected (422)."""
    r = await client.post(
        "/api/workflows",
        json={
            "name": "Bad Graph",
            "description": "",
            "graph_definition": {
                "nodes": [
                    {"id": "a", "type": "condition"},
                    {"id": "b", "type": "condition"},
                ],
                "edges": [
                    {"id": "e1", "source": "a", "target": "b"},
                    {"id": "e2", "source": "b", "target": "a"},
                ],
            },
            "is_template": False,
        },
    )
    assert r.status_code == 422


@pytest.mark.anyio
async def test_workflow_update_graph_definition(client):
    """Graph definition can be updated after creation."""
    r = await client.post(
        "/api/workflows",
        json={
            "name": "Updatable",
            "description": "",
            "graph_definition": {
                "nodes": [{"id": "start", "type": "start"}, {"id": "end", "type": "end"}],
                "edges": [{"id": "e1", "source": "start", "target": "end"}],
            },
            "is_template": False,
        },
    )
    wf_id = r.json()["id"]

    updated = await client.put(
        f"/api/workflows/{wf_id}",
        json={"name": "Updatable v2"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updatable v2"


@pytest.mark.anyio
async def test_workflow_delete(client):
    """Deleting a workflow makes it inaccessible."""
    r = await client.post(
        "/api/workflows",
        json={
            "name": "To Delete",
            "description": "",
            "graph_definition": {
                "nodes": [{"id": "start", "type": "start"}, {"id": "end", "type": "end"}],
                "edges": [{"id": "e1", "source": "start", "target": "end"}],
            },
            "is_template": False,
        },
    )
    wf_id = r.json()["id"]
    del_r = await client.delete(f"/api/workflows/{wf_id}")
    assert del_r.status_code == 204
    get_r = await client.get(f"/api/workflows/{wf_id}")
    assert get_r.status_code == 404
