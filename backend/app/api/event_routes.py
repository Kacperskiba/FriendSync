from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.schemas.event import EventCreate, EventResponse
from app.crud.event import create_event, get_user_events, get_event, get_participant, add_user_to_event
from app.crud.user import get_user_by_email
from app.models.user import User
router = APIRouter(prefix="/api/events", tags=["Events"])

@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_new_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # BRAMKARZ! Bez tokena tu nie wejdziesz.
):
    """
    Tworzy nowe wydarzenie.
    Wymaga podania w nagłówku poprawnego tokena JWT.
    """
    # Zauważ, że nie musimy pytać Frontendu, kim jest użytkownik.
    # 'current_user' wyciągnął tę informację w bezpieczny sposób prosto z tokena!
    return create_event(db=db, event=event, user_id=current_user.id)

@router.get("/", response_model=List[EventResponse])
def read_user_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user) # BRAMKARZ pilnuje dostępu!
):
    """
    Pobiera listę wszystkich wydarzeń, w których bierze udział zalogowany użytkownik.
    """
    return get_user_events(db=db, user_id=current_user.id)


@router.post("/{event_id}/invite", status_code=status.HTTP_200_OK)
def invite_friend_to_event(
        event_id: int,
        invite_data: EventInvite,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)  # Wymaga logowania!
):
    """
    Zaprasza użytkownika do wydarzenia na podstawie adresu email.
    """
    # 1. Sprawdzamy, czy wydarzenie istnieje
    event = get_event(db, event_id=event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Wydarzenie nie istnieje.")

    # 2. Sprawdzamy, czy zapraszający sam jest w tym wydarzeniu
    # (nie pozwalamy zapraszać ludzi do cudzych wydarzeń!)
    inviter = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not inviter:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego wydarzenia.")

    # 3. Szukamy znajomego w bazie po jego adresie email
    friend = get_user_by_email(db, email=invite_data.email)
    if not friend:
        raise HTTPException(status_code=404, detail="Nie znaleziono użytkownika o takim adresie email.")

    # 4. Sprawdzamy, czy znajomy nie został już wcześniej dodany
    existing_participant = get_participant(db, event_id=event_id, user_id=friend.id)
    if existing_participant:
        raise HTTPException(status_code=400, detail="Ten użytkownik jest już w tym wydarzeniu.")

    # 5. Dodajemy znajomego do wydarzenia
    add_user_to_event(db=db, event_id=event_id, user_id=friend.id)

    return {"message": f"Użytkownik {friend.username} został dodany do wydarzenia!"}