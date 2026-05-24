import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models.agent import Agent
from app.models.workflow import Workflow


def agent_payload(name: str, role: str, prompt: str, tools: list[str]) -> dict:
    return {
        "name": name,
        "role": role,
        "system_prompt": prompt,
        "model": "gemini-2.5-flash",
        "tools": tools,
        "memory_enabled": True,
        "memory_config": {"type": "buffer", "window_size": 8},
        "guardrails": {"max_tokens_per_run": 4000, "max_cost_usd": 1.0, "forbidden_topics": []},
        "channel_config": {},
    }


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(Workflow).where(Workflow.is_template.is_(True)))
        if len(existing.scalars().all()) >= 2:
            return
        support_agents = [
            Agent(
                **agent_payload(
                    "Triage Agent",
                    "Classifies customer requests",
                    "Classify the request as billing, technical, or general. Include the chosen category clearly.",
                    [],
                )
            ),
            Agent(
                **agent_payload(
                    "Billing Agent",
                    "Handles billing questions",
                    "Resolve billing questions using available HTTP systems when useful.",
                    ["http_request"],
                )
            ),
            Agent(
                **agent_payload(
                    "Technical Agent",
                    "Handles technical issues",
                    "Investigate technical problems and search for current troubleshooting guidance.",
                    ["web_search"],
                )
            ),
            Agent(
                **agent_payload(
                    "Responder Agent",
                    "Creates final replies",
                    "Format the final response professionally and concisely for a customer.",
                    [],
                )
            ),
        ]
        research_agents = [
            Agent(
                **agent_payload(
                    "Researcher Agent",
                    "Finds source material",
                    "Search the web for reliable current information on the topic.",
                    ["web_search"],
                )
            ),
            Agent(
                **agent_payload(
                    "Analyst Agent",
                    "Synthesizes research",
                    "Analyze the research and extract key implications.",
                    [],
                )
            ),
            Agent(
                **agent_payload(
                    "Writer Agent",
                    "Writes reports",
                    "Write a structured report with headings and cited source links when available.",
                    [],
                )
            ),
            Agent(
                **agent_payload(
                    "Reviewer Agent",
                    "Reviews quality",
                    "Review the report. End with either 'quality = good' or 'quality = revise'.",
                    [],
                )
            ),
        ]
        db.add_all(support_agents + research_agents)
        await db.flush()
        s = [str(a.id) for a in support_agents]
        r = [str(a.id) for a in research_agents]
        support_graph = {
            "nodes": [
                {"id": "start", "type": "start"},
                {"id": "triage", "type": "agent", "agent_id": s[0]},
                {
                    "id": "billing_cond",
                    "type": "condition",
                    "condition_expr": f"agent_outputs['{s[0]}'] contains 'billing'",
                },
                {
                    "id": "tech_cond",
                    "type": "condition",
                    "condition_expr": f"agent_outputs['{s[0]}'] contains 'technical'",
                },
                {"id": "billing", "type": "agent", "agent_id": s[1]},
                {"id": "technical", "type": "agent", "agent_id": s[2]},
                {"id": "responder", "type": "agent", "agent_id": s[3]},
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "triage"},
                {"id": "e2", "source": "triage", "target": "billing_cond"},
                {"id": "e3", "source": "billing_cond", "target": "billing", "label": "true"},
                {"id": "e4", "source": "billing_cond", "target": "tech_cond", "label": "false"},
                {"id": "e5", "source": "tech_cond", "target": "technical", "label": "true"},
                {"id": "e6", "source": "tech_cond", "target": "responder", "label": "false"},
                {"id": "e7", "source": "billing", "target": "responder"},
                {"id": "e8", "source": "technical", "target": "responder"},
                {"id": "e9", "source": "responder", "target": "end"},
            ],
        }
        research_graph = {
            "nodes": [
                {"id": "start", "type": "start"},
                {"id": "researcher", "type": "agent", "agent_id": r[0]},
                {"id": "analyst", "type": "agent", "agent_id": r[1]},
                {"id": "writer", "type": "agent", "agent_id": r[2]},
                {"id": "reviewer", "type": "agent", "agent_id": r[3]},
                {"id": "quality", "type": "condition", "condition_expr": "quality = good"},
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"id": "e1", "source": "start", "target": "researcher"},
                {"id": "e2", "source": "researcher", "target": "analyst"},
                {"id": "e3", "source": "analyst", "target": "writer"},
                {"id": "e4", "source": "writer", "target": "reviewer"},
                {"id": "e5", "source": "reviewer", "target": "quality"},
                {"id": "e6", "source": "quality", "target": "end", "label": "true"},
                {
                    "id": "e7",
                    "source": "quality",
                    "target": "writer",
                    "label": "false",
                    "feedback_loop": True,
                },
            ],
        }
        db.add_all(
            [
                Workflow(
                    name="Customer Support Pipeline",
                    description="Triage, specialist handling, and polished response.",
                    graph_definition=support_graph,
                    is_template=True,
                ),
                Workflow(
                    name="Research & Report Generator",
                    description="Research, analysis, writing, and review feedback loop.",
                    graph_definition=research_graph,
                    is_template=True,
                ),
            ]
        )
        await db.commit()


if __name__ == "__main__":
    asyncio.run(seed())
