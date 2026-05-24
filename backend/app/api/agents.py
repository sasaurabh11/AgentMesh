from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.runtime.llm_factory import build_chat_model, normalize_model_name
from app.models.agent import Agent
from app.schemas.agent import (
    AgentCreate,
    AgentRead,
    AgentTestRequest,
    AgentTestResponse,
    AgentUpdate,
)
from app.utils.cost_tracker import calculate_cost, count_tokens

router = APIRouter(prefix="/api/agents", tags=["agents"])


@router.post("", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_agent(payload: AgentCreate, db: AsyncSession = Depends(get_db)):
    agent = Agent(**payload.model_dump())
    db.add(agent)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.get("", response_model=list[AgentRead])
async def list_agents(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Agent).order_by(Agent.created_at.desc()))
    return result.scalars().all()


@router.get("/{agent_id}", response_model=AgentRead)
async def get_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="agent not found")
    return agent


@router.put("/{agent_id}", response_model=AgentRead)
async def update_agent(agent_id: UUID, payload: AgentUpdate, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="agent not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(agent, key, value)
    await db.commit()
    await db.refresh(agent)
    return agent


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: UUID, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="agent not found")
    await db.delete(agent)
    await db.commit()


@router.post("/{agent_id}/test", response_model=AgentTestResponse)
async def test_agent(agent_id: UUID, payload: AgentTestRequest, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="agent not found")
    llm = build_chat_model(agent.model)
    prompt = f"{agent.system_prompt}\n\nUser message: {payload.input}"
    result = await llm.ainvoke(prompt)
    output = str(result.content)
    input_tokens = count_tokens(prompt, normalize_model_name(agent.model))
    output_tokens = count_tokens(output, normalize_model_name(agent.model))
    cost = calculate_cost(agent.model, input_tokens, output_tokens)
    return AgentTestResponse(output=output, tokens=input_tokens + output_tokens, cost_usd=cost)
