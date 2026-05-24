from __future__ import annotations

from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.execution import Execution, ExecutionLog
from app.models.message import Message
from app.runtime.human_input import submit_input
from app.schemas.execution import ExecutionLogRead, ExecutionRead
from app.schemas.message import MessageRead

router = APIRouter(prefix="/api/executions", tags=["executions"])


@router.get("", response_model=list[ExecutionRead])
async def list_executions(
    workflow_id: UUID | None = Query(default=None), db: AsyncSession = Depends(get_db)
):
    stmt = select(Execution).order_by(Execution.started_at.desc().nullslast())
    if workflow_id:
        stmt = stmt.where(Execution.workflow_id == workflow_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{execution_id}", response_model=ExecutionRead)
async def get_execution(execution_id: UUID, db: AsyncSession = Depends(get_db)):
    execution = await db.get(Execution, execution_id)
    if not execution:
        raise HTTPException(status_code=404, detail="execution not found")
    return execution


@router.get("/{execution_id}/logs", response_model=list[ExecutionLogRead])
async def get_execution_logs(execution_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ExecutionLog)
        .where(ExecutionLog.execution_id == execution_id)
        .order_by(ExecutionLog.created_at)
    )
    return result.scalars().all()


@router.get("/{execution_id}/messages", response_model=list[MessageRead])
async def get_execution_messages(execution_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message).where(Message.execution_id == execution_id).order_by(Message.created_at)
    )
    return result.scalars().all()


class HumanInputPayload(BaseModel):
    input: str


@router.post("/{execution_id}/input")
async def submit_execution_input(execution_id: UUID, payload: HumanInputPayload):
    accepted = await submit_input(str(execution_id), payload.input)
    if not accepted:
        raise HTTPException(
            status_code=400,
            detail="This execution is not currently waiting for input.",
        )
    return {"status": "ok"}
