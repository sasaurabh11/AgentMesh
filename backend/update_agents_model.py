"""One-time script: update all agents that still use gpt-4o-mini to gemini-2.5-flash."""
import asyncio
from sqlalchemy import select, update
from app.database import AsyncSessionLocal
from app.models.agent import Agent


async def run() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Agent).where(Agent.model == "gpt-4o-mini"))
        agents = result.scalars().all()
        if not agents:
            print("No agents using gpt-4o-mini found.")
            return
        await db.execute(
            update(Agent).where(Agent.model == "gpt-4o-mini").values(model="gemini-2.5-flash")
        )
        await db.commit()
        print(f"Updated {len(agents)} agent(s) to gemini-2.5-flash:")
        for a in agents:
            print(f"  - {a.name}")


if __name__ == "__main__":
    asyncio.run(run())
