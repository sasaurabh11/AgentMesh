from uuid import UUID
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from app.database import get_db
from app.runtime.llm_factory import build_chat_model, normalize_model_name
from app.runtime.tool_registry import get_tools
from app.models.agent import Agent
from app.schemas.agent import (
    AgentCreate,
    AgentRead,
    AgentTestRequest,
    AgentTestResponse,
    AgentUpdate,
    ToolStep,
)
from app.utils.cost_tracker import calculate_cost, count_tokens

# Tools that require a live workflow execution context — exclude from chat/test mode
_WORKFLOW_ONLY_TOOLS = {"delegate_to_agent", "request_human_input"}


def _extract_text(content) -> str:
    """Pull plain text out of an AIMessage content field regardless of format.

    Models return content in several shapes:
      - str          → regular models (OpenAI, most Gemini)
      - list[str]    → Gemma (thinking trace + final answer as separate strings)
      - list[dict]   → multipart/thinking models: {"type":"text","text":"..."} or
                       {"type":"thinking","thinking":"..."}  (Gemini 2.5, Claude 3)
      - list[obj]    → Pydantic content-block objects with a .text attribute

    For list formats, thinking models put the final answer last, so we keep only
    that last non-empty piece to avoid leaking internal reasoning to the user.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for p in content:
            if isinstance(p, str):
                if p.strip():
                    parts.append(p.strip())
            elif isinstance(p, dict):
                if p.get("type") == "text" and p.get("text", "").strip():
                    parts.append(p["text"].strip())
                elif p.get("type") not in ("thinking", "tool_use") and "text" in p and p["text"].strip():
                    parts.append(p["text"].strip())
            elif hasattr(p, "text") and isinstance(p.text, str) and p.text.strip():
                parts.append(p.text.strip())
        # Thinking models (Gemma, Gemini 2.5) emit [reasoning, final_answer].
        # Return only the last part so the user sees the answer, not the trace.
        return parts[-1] if parts else ""
    return str(content)

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

    llm = build_chat_model(agent.model, api_key=agent.api_key or None)
    model_key = normalize_model_name(agent.model)

    # Build conversation history as LangChain message objects
    chat_history: list = []
    for m in payload.messages:
        chat_history.append(HumanMessage(content=m.content) if m.role == "user" else AIMessage(content=m.content))

    # Filter out tools that only work inside a live workflow execution
    filtered_workflow_tools = [t for t in (agent.tools or []) if t in _WORKFLOW_ONLY_TOOLS]
    chat_tools = [t for t in (agent.tools or []) if t not in _WORKFLOW_ONLY_TOOLS]
    tools = get_tools(chat_tools)

    # When workflow-only tools are stripped the model's system prompt still tells it to call
    # them, so the LLM emits a tool-call message with empty text → output = "".
    # Fix: tell the model explicitly it must reply in plain text; no tool calls allowed.
    effective_system_prompt = agent.system_prompt
    if filtered_workflow_tools:
        effective_system_prompt += (
            "\n\n[IMPORTANT — CHAT PREVIEW MODE]\n"
            f"The tools {', '.join(filtered_workflow_tools)} are NOT available right now.\n"
            "You MUST NOT emit any function calls or tool-use requests.\n"
            "Instead respond in plain text:\n"
            "  • If you would normally delegate, describe who you would delegate to and why.\n"
            "  • If you would ask the user something, ask it directly as a question.\n"
            "  • If you have enough context, outline your plan step by step.\n"
            "Plain text reply only — no JSON, no function calls."
        )

    steps: list[ToolStep] = []

    # Retry up to 3 times on transient Google 503 overload errors
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            if tools:
                prompt = ChatPromptTemplate.from_messages([
                    ("system", effective_system_prompt),
                    MessagesPlaceholder("chat_history", optional=True),
                    ("human", "{input}"),
                    MessagesPlaceholder("agent_scratchpad"),
                ])
                lc_agent = create_tool_calling_agent(llm, tools, prompt)
                executor = AgentExecutor(
                    agent=lc_agent, tools=tools, verbose=False, return_intermediate_steps=True
                )
                response = await executor.ainvoke({"input": payload.input, "chat_history": chat_history})
                output = str(response.get("output", ""))
                context_text = effective_system_prompt + payload.input
                for action, result in response.get("intermediate_steps", []):
                    tool_input = getattr(action, "tool_input", "")
                    steps.append(ToolStep(
                        tool=getattr(action, "tool", "unknown"),
                        input=str(tool_input) if not isinstance(tool_input, str) else tool_input,
                        output=str(result)[:2000],
                    ))
            else:
                msgs: list = [SystemMessage(content=effective_system_prompt)] + chat_history + [HumanMessage(content=payload.input)]
                result = await llm.ainvoke(msgs)
                output = _extract_text(result.content)

                # Fallback: model still emitted a tool-call instead of plain text.
                # Reconstruct a human-readable reply from the tool call arguments.
                if not output.strip() and getattr(result, "tool_calls", None):
                    parts: list[str] = []
                    for tc in result.tool_calls:
                        name = tc.get("name", "")
                        args = tc.get("args", {})
                        if name == "request_human_input":
                            parts.append(args.get("question") or args.get("prompt") or str(args))
                        elif name == "delegate_to_agent":
                            task = args.get("task") or args.get("message") or str(args)
                            parts.append(f"I would delegate this to a specialist agent: {task}")
                        elif name:
                            parts.append(f"[Would call {name}: {args}]")
                    output = "\n".join(parts)

                context_text = " ".join(m.content for m in msgs if hasattr(m, "content") and isinstance(m.content, str))
            break  # success — exit retry loop
        except Exception as e:
            err_str = str(e).lower()
            if "503" in err_str or "unavailable" in err_str or "high demand" in err_str:
                last_exc = e
                if attempt < 2:
                    await asyncio.sleep(3 * (attempt + 1))
                    continue
            raise
    else:
        raise HTTPException(
            status_code=503,
            detail=f"The model is overloaded and did not recover after retries. Try again in a moment. ({last_exc})",
        )

    input_tokens = count_tokens(context_text, model_key)
    output_tokens = count_tokens(output, model_key)
    cost = calculate_cost(agent.model, input_tokens, output_tokens)
    return AgentTestResponse(
        output=output, tokens=input_tokens + output_tokens, cost_usd=cost, steps=steps
    )
