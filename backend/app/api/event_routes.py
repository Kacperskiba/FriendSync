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
from app.schemas.message import MessageCreate, MessageResponse
from app.crud.message import create_message, get_event_messages
from app.schemas.expense import ExpenseCreate, ExpenseResponse, FinanceSummaryResponse
from app.crud.expense import create_expense, get_event_expenses, calculate_finance_summary


class EventInvite(BaseModel):
    email: str
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


# --- UCZESTNICY: POBIERANIE LISTY ---
@router.get("/{event_id}/participants",
            response_model=List[EventResponse.UserResponse] if hasattr(EventResponse, 'UserResponse') else List[dict])
def get_event_participants(
        event_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """
    Pobiera listę wszystkich osób biorących udział w wydarzeniu.
    Potrzebne, aby na froncie zamienić ID płatnika na jego Imię/Username.
    """
    # 1. Sprawdzamy, czy użytkownik ma dostęp do tego wydarzenia
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do listy uczestników tego wydarzenia.")

    # 2. Pobieramy uczestników przez relację w modelu Event
    event = get_event(db, event_id=event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Wydarzenie nie istnieje.")

    # Wyciągamy obiekty User z tabeli łączącej EventParticipant
    users = [p.user for p in event.participants]

    # Zwracamy listę prostych obiektów (id i username)
    return [{"id": u.id, "username": u.username} for u in users]

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


# --- CZAT: WYSYŁANIE WIADOMOŚCI ---
@router.post("/{event_id}/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
def send_event_message(
        event_id: int,
        message: MessageCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Wysyła nową wiadomość na czacie wydarzenia."""
    # 1. Sprawdzamy czy użytkownik ma dostęp (czy jest uczestnikiem)
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do czatu tego wydarzenia.")

    # 2. Tworzymy wiadomość
    return create_message(db=db, event_id=event_id, user_id=current_user.id, message=message)


# --- CZAT: ODCZYTYWANIE WIADOMOŚCI ---
@router.get("/{event_id}/messages", response_model=List[MessageResponse])
def read_event_messages(
        event_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Pobiera całą historię czatu dla wydarzenia."""
    # 1. Ponownie - bramkarz sprawdza dostęp do wydarzenia
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do czatu tego wydarzenia.")

    return get_event_messages(db=db, event_id=event_id)


# --- FINANSE: DODAWANIE WYDATKU ---
@router.post("/{event_id}/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def add_event_expense(
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

    # 2. Zapisujemy wydatek w bazie
    return create_expense(db=db, event_id=event_id, payer_id=current_user.id, expense_data=expense)


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


# --- FINANSE: PODSUMOWANIE I WYRÓWNANIE DŁUGÓW ---
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