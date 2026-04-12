from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.event import EventCreate, EventResponse
from app.crud import event as event_crud

router = APIRouter(prefix="/api/events", tags=["Events"])

@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_new_event(
    event_in: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Tworzy nowe wydarzenie i przypisuje twórcę jako admina."""
    return event_crud.create_event(db=db, event_in=event_in, creator_id=current_user.id)

@router.get("/", response_model=List[EventResponse])
def read_my_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pobiera listę wydarzeń, do których należy zalogowany użytkownik."""
    return event_crud.get_events_for_user(db=db, user_id=current_user.id)

@router.get("/{event_id}", response_model=EventResponse)
def read_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pobiera szczegóły konkretnego wydarzenia."""
    db_event = event_crud.get_event_by_id(db, event_id=event_id)
    if not db_event:
        raise HTTPException(status_code=404, detail="Wydarzenie nie istnieje")
    return db_event