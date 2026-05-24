from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
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


@router.post("/orchestrator", response_model=AgentRead, status_code=status.HTTP_201_CREATED)
async def create_orchestrator(db: AsyncSession = Depends(get_db)):
    """Create (or replace) an Orchestrator agent pre-wired with all current agents."""
    result = await db.execute(select(Agent).order_by(Agent.created_at.asc()))
    agents = [a for a in result.scalars().all() if a.name != "Orchestrator"]

    agent_list = "\n".join(f"  - {a.name} (id: {a.id}): {a.role}" for a in agents)
    system_prompt = (
        "You are the Orchestrator — the central coordinator for this AI platform.\n\n"
        "Your responsibilities:\n"
        "1. Understand what the user wants to accomplish.\n"
        "2. If the request is unclear or missing key details, use the request_human_input tool "
        "to ask the user ONE focused question at a time.\n"
        "3. Once you have enough information, delegate the task to the best specialist agent "
        "using the delegate_to_agent tool.\n"
        "4. Summarise the specialist's response clearly for the user.\n\n"
        "Available specialist agents:\n"
        f"{agent_list if agent_list else '  (no specialist agents created yet)'}\n\n"
        "Rules:\n"
        "- Never answer specialist questions yourself; always delegate.\n"
        "- Ask at most 2–3 clarifying questions before proceeding.\n"
        "- If no agent matches, say so and suggest creating one."
    )

    # Remove any existing orchestrator so there's only one
    existing = await db.execute(select(Agent).where(Agent.name == "Orchestrator"))
    for old in existing.scalars().all():
        await db.delete(old)

    orchestrator = Agent(
        name="Orchestrator",
        role="Routes tasks to specialist agents and asks users for clarification when needed",
        system_prompt=system_prompt,
        model="gemini-2.5-flash",
        tools=["delegate_to_agent", "request_human_input"],
        memory_enabled=False,
        memory_config={},
        guardrails={"max_tokens_per_run": 8000, "max_cost_usd": 5},
        schedule=None,
        channel=None,
        channel_config={},
    )
    db.add(orchestrator)
    await db.commit()
    await db.refresh(orchestrator)
    return orchestrator


@router.post("/{agent_id}/test", response_model=AgentTestResponse)
async def test_agent(agent_id: UUID, payload: AgentTestRequest, db: AsyncSession = Depends(get_db)):
    agent = await db.get(Agent, agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="agent not found")
    llm = build_chat_model(agent.model)

    # Build a proper message sequence so the agent has full conversation context
    msgs: list = [SystemMessage(content=agent.system_prompt)]
    for m in payload.messages:
        if m.role == "user":
            msgs.append(HumanMessage(content=m.content))
        else:
            msgs.append(AIMessage(content=m.content))
    msgs.append(HumanMessage(content=payload.input))

    result = await llm.ainvoke(msgs)
    output = str(result.content)

    # Rough token count over the full context
    full_text = " ".join(
        m.content if hasattr(m, "content") else str(m) for m in msgs
    )
    model_key = normalize_model_name(agent.model)
    input_tokens = count_tokens(full_text, model_key)
    output_tokens = count_tokens(output, model_key)
    cost = calculate_cost(agent.model, input_tokens, output_tokens)
    return AgentTestResponse(output=output, tokens=input_tokens + output_tokens, cost_usd=cost)
