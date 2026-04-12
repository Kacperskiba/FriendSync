from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse
from app.crud import message as message_crud

router = APIRouter(prefix="/api/messages", tags=["Messages"])

@router.post("/{event_id}", response_model=MessageResponse)
def send_message(
    event_id: int,
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return message_crud.create_message(db, msg_in.content, event_id, current_user.id)

@router.get("/{event_id}", response_model=List[MessageResponse])
def get_messages(event_id: int, db: Session = Depends(get_db)):
    return message_crud.get_event_messages(db, event_id)