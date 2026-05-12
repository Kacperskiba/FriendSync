from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel

from app.core.database import get_db
from app.api.dependencies import get_current_user
from app.schemas.event import EventCreate, EventResponse
from app.crud.event import create_event, get_user_events, get_event, get_participant, add_user_to_event, delete_event, \
    update_sub_event, update_event, delete_sub_event
from app.crud.user import get_user_by_email
from app.models.user import User
from app.schemas.message import MessageCreate, MessageResponse
from app.crud.message import create_message, get_event_messages
from app.schemas.expense import ExpenseCreate, ExpenseResponse, FinanceSummaryResponse
from app.crud.expense import create_expense, get_event_expenses, calculate_finance_summary
from app.api.websocket import manager
from app.schemas.event import SubEventCreate, SubEventResponse
from app.crud.event import create_sub_event

from app.schemas.event import EventUpdate, SubEventUpdate
from app.api.websocket import manager

from app.models.event import Event

from app.models.sub_event import SubEvent


class EventInvite(BaseModel):
    email: str


router = APIRouter(prefix="/api/events", tags=["Events"])


@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_new_event(
        event: EventCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)  # BRAMKARZ! Bez tokena tu nie wejdziesz.
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
        current_user: User = Depends(get_current_user)  # BRAMKARZ pilnuje dostępu!
):
    """
    Pobiera listę wszystkich wydarzeń, w których bierze udział zalogowany użytkownik.
    """
    return get_user_events(db=db, user_id=current_user.id)


# --- UCZESTNICY: POBIERANIE LISTY ---
@router.get("/{event_id}/participants")
def get_event_participants(
        event_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # 1. Sprawdzamy dostęp (Twoja logika jest OK)
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Brak dostępu")

    event = get_event(db, event_id=event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Wydarzenie nie istnieje")

    # 2. Pobieramy użytkowników
    users = [p.user for p in event.participants]

    # 3. KLUCZOWA ZMIANA: Dodajemy profile_image do zwracanych danych
    return [
        {
            "id": u.id,
            "username": u.username,
            "profile_image": u.profile_image  # <-- To musi tu być!
        } for u in users
    ]


@router.post("/{event_id}/invite", status_code=status.HTTP_200_OK)
async def invite_friend_to_event(
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

    await manager.broadcast(event_id)
    return {"message": f"Użytkownik {friend.username} został dodany do wydarzenia!"}


# --- CZAT: WYSYŁANIE WIADOMOŚCI ---
@router.post("/{event_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_event_message(
        event_id: int,
        message: MessageCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do czatu tego wydarzenia.")

    # create_message powinno zwracać obiekt modelu Message z załadowaną relacją 'author'
    new_msg = create_message(db=db, event_id=event_id, user_id=current_user.id, message=message)

    await manager.broadcast(event_id)
    return new_msg


# --- CZAT: ODCZYTYWANIE WIADOMOŚCI ---
@router.get("/{event_id}/messages", response_model=List[MessageResponse])
def read_event_messages(
        event_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do czatu tego wydarzenia.")

    # Pobieramy wiadomości
    messages = get_event_messages(db=db, event_id=event_id)

    # Dzięki response_model=List[MessageResponse], FastAPI samo
    # wyciągnie profile_image z relacji author w każdej wiadomości.
    return messages


# --- FINANSE: DODAWANIE WYDATKU ---
@router.post("/{event_id}/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def add_event_expense(
        event_id: int,
        expense: ExpenseCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Dodaje nowy wydatek i dzieli go na uczestników."""
    # 1. Sprawdzamy, czy użytkownik ma dostęp do wydarzenia
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego wydarzenia.")

    # Małe zabezpieczenie: Sprawdzamy czy suma długów nie przekracza kwoty paragonu
    total_shares = sum(share.amount for share in expense.shares)
    if total_shares > expense.amount:
        raise HTTPException(status_code=400, detail="Suma długów jest większa niż całkowita kwota wydatku!")

    new_expense = create_expense(db=db, event_id=event_id, payer_id=current_user.id, expense_data=expense)

    await manager.broadcast(event_id)
    return new_expense


# --- FINANSE: ODCZYTYWANIE WYDATKÓW ---
@router.get("/{event_id}/expenses", response_model=List[ExpenseResponse])
def read_event_expenses(
        event_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Pobiera historię wszystkich wydatków w wydarzeniu."""
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego wydarzenia.")

    return get_event_expenses(db=db, event_id=event_id)



@router.get("/{event_id}/finances/summary", response_model=FinanceSummaryResponse)
def get_event_finance_summary(
        event_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Oblicza całkowity koszt wydarzenia i generuje listę przelewów potrzebnych
    do wyrównania wszystkich rachunków między uczestnikami.
    """
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego wydarzenia.")

    return calculate_finance_summary(db=db, event_id=event_id)

@router.post("/{event_id}/sub-events", response_model=SubEventResponse)
def add_sub_event(event_id: int, sub_event: SubEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return create_sub_event(db=db, event_id=event_id, sub_event=sub_event)


# Edycja wydarzenia
@router.put("/{event_id}", response_model=EventResponse)
async def edit_event(event_id: int, event_update: EventUpdate, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event or db_event.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Brak uprawnień do edycji")

    updated = update_event(db, event_id, event_update)
    await manager.broadcast(event_id)  # Powiadom innych
    return updated


# Usuwanie wydarzenia
@router.delete("/{event_id}")
async def remove_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event or db_event.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    delete_event(db, event_id)
    # Tutaj też możemy dać await manager.broadcast(event_id), żeby wyrzucić ludzi z usuniętego wydarzenia
    return {"message": "Wydarzenie usunięte"}

# Edycja SubEventu
@router.put("/sub-events/{sub_event_id}", response_model=SubEventResponse)
async def edit_sub_event(sub_event_id: int, sub_update: SubEventUpdate, db: Session = Depends(get_db)):
    updated = update_sub_event(db, sub_event_id, sub_update)
    if updated:
        await manager.broadcast(updated.event_id)
    return updated


# Usuwanie SubEventu
@router.delete("/sub-events/{sub_event_id}")
async def remove_sub_event(sub_event_id: int, db: Session = Depends(get_db)):
    db_sub = db.query(SubEvent).filter(SubEvent.id == sub_event_id).first()
    if db_sub:
        event_id = db_sub.event_id
        delete_sub_event(db, sub_event_id)
        await manager.broadcast(event_id)
    return {"message": "Punkt usunięty"}