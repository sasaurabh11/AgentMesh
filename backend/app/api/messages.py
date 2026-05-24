from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.message import Message
from app.schemas.message import MessageRead

router = APIRouter(prefix="/api/messages", tags=["messages"])


@router.get("", response_model=list[MessageRead])
async def list_messages(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Message).order_by(Message.created_at.desc()).limit(200))
    return result.scalars().all()
