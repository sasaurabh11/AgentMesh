from uuid import UUID
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.execution import Execution
from app.models.workflow import Workflow
from app.runtime.executor import execute_workflow
from app.schemas.workflow import (
    WorkflowCreate,
    WorkflowExecuteRequest,
    WorkflowExecuteResponse,
    WorkflowRead,
    WorkflowUpdate,
)

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(payload: WorkflowCreate, db: AsyncSession = Depends(get_db)):
    workflow = Workflow(**payload.model_dump())
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return workflow


@router.get("/templates", response_model=list[WorkflowRead])
async def list_templates(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Workflow).where(Workflow.is_template.is_(True)).order_by(Workflow.name)
    )
    return result.scalars().all()


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(
    include_templates: bool = Query(default=True), db: AsyncSession = Depends(get_db)
):
    stmt = select(Workflow).order_by(Workflow.created_at.desc())
    if not include_templates:
        stmt = stmt.where(Workflow.is_template.is_(False))
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(workflow_id: UUID, db: AsyncSession = Depends(get_db)):
    workflow = await db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="workflow not found")
    return workflow


@router.put("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(
    workflow_id: UUID, payload: WorkflowUpdate, db: AsyncSession = Depends(get_db)
):
    workflow = await db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="workflow not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(workflow, key, value)
    await db.commit()
    await db.refresh(workflow)
    return workflow


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(workflow_id: UUID, db: AsyncSession = Depends(get_db)):
    workflow = await db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="workflow not found")
    await db.delete(workflow)
    await db.commit()


@router.post("/{workflow_id}/execute", response_model=WorkflowExecuteResponse)
async def trigger_workflow(
    workflow_id: UUID,
    payload: WorkflowExecuteRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    workflow = await db.get(Workflow, workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="workflow not found")
    execution = Execution(
        workflow_id=workflow.id,
        trigger_channel="api",
        trigger_input=payload.input,
        status="pending",
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)
    background_tasks.add_task(
        execute_workflow, str(workflow.id), payload.input, "api", str(execution.id), None
    )
    return WorkflowExecuteResponse(execution_id=execution.id, status=execution.status)
