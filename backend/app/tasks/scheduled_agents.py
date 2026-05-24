import asyncio
from celery import Celery
from sqlalchemy import select
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models.agent import Agent
from app.models.workflow import Workflow
from app.runtime.executor import execute_workflow

settings = get_settings()
celery_app = Celery("agentmesh", broker=settings.redis_url, backend=settings.redis_url)


@celery_app.task(name="run_scheduled_agents")
def run_scheduled_agents() -> int:
    return asyncio.run(_run_scheduled_agents())


async def _run_scheduled_agents() -> int:
    count = 0
    async with AsyncSessionLocal() as db:
        agents = (
            (await db.execute(select(Agent).where(Agent.schedule.is_not(None)))).scalars().all()
        )
        workflows = (await db.execute(select(Workflow))).scalars().all()
        for agent in agents:
            for workflow in workflows:
                if any(
                    str(node.get("agent_id")) == str(agent.id)
                    for node in (workflow.graph_definition or {}).get("nodes", [])
                ):
                    await execute_workflow(str(workflow.id), "Scheduled execution", "schedule")
                    count += 1
                    break
    return count
