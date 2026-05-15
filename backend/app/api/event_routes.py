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
from app.crud.expense import (
    create_expense,
    get_event_expenses,
    calculate_finance_summary,
    settle_share,
    settle_all_with_creditor,
)
from app.models.expense import Expense, ExpenseShare
from app.api.websocket import manager
from app.schemas.event import SubEventCreate, SubEventResponse
from app.crud.event import create_sub_event

from app.schemas.event import EventUpdate, SubEventUpdate, EventInvitationResponse

from app.models.event import Event, EventParticipant
from app.models.event_invitation import EventInvitation
from app.crud.notification import create_notification

from app.models.sub_event import SubEvent


class EventInvite(BaseModel):
    email: str


router = APIRouter(prefix="/api/events", tags=["Events"])


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("", response_model=List[EventResponse])
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

    # 4b. Sprawdzamy czy nie wisi już zaproszenie
    existing_inv = db.query(EventInvitation).filter(
        EventInvitation.event_id == event_id,
        EventInvitation.user_id == friend.id,
        EventInvitation.status == "pending"
    ).first()
    if existing_inv:
        raise HTTPException(status_code=400, detail="Zaproszenie do tego wydarzenia już zostało wysłane.")

    # 5. Tworzymy zaproszenie (status pending)
    invitation = EventInvitation(
        event_id=event_id,
        user_id=friend.id,
        inviter_id=current_user.id,
        status="pending"
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)

    create_notification(
        db=db,
        user_id=friend.id,
        notif_type="event_invitation",
        message=f"{current_user.username} zaprosił Cię do wydarzenia „{event.title}”."
    )

    await manager.send_to_user(friend.id, {"type": "event_invitation_new"})
    return {"message": f"Wysłano zaproszenie do {friend.username}."}


@router.get("/invitations", response_model=List[EventInvitationResponse])
def list_my_event_invitations(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Zwraca pending zaproszenia do wydarzeń dla zalogowanego usera."""
    return db.query(EventInvitation).filter(
        EventInvitation.user_id == current_user.id,
        EventInvitation.status == "pending"
    ).order_by(EventInvitation.created_at.desc()).all()


@router.post("/invitations/{invitation_id}/accept")
async def accept_event_invitation(
        invitation_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    inv = db.query(EventInvitation).filter(
        EventInvitation.id == invitation_id,
        EventInvitation.user_id == current_user.id,
        EventInvitation.status == "pending"
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Zaproszenie nie istnieje.")

    event_id = inv.event_id
    inviter_id = inv.inviter_id

    # Dodaj jako uczestnika i usuń invitation
    add_user_to_event(db=db, event_id=event_id, user_id=current_user.id)
    db.delete(inv)
    db.commit()

    # Powiadomienie dla zapraszającego
    ev = db.query(Event).filter(Event.id == event_id).first()
    create_notification(
        db=db,
        user_id=inviter_id,
        notif_type="event_invitation_accepted",
        message=f"{current_user.username} dołączył do „{ev.title if ev else 'wydarzenia'}”."
    )
    await manager.send_to_user(inviter_id, {"type": "event_invitation_resolved"})

    # Wszyscy uczestnicy (włącznie z nowym) widzą zmianę
    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return {"message": "Zaproszenie zaakceptowane."}


@router.post("/invitations/{invitation_id}/decline")
async def decline_event_invitation(
        invitation_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    inv = db.query(EventInvitation).filter(
        EventInvitation.id == invitation_id,
        EventInvitation.user_id == current_user.id,
        EventInvitation.status == "pending"
    ).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Zaproszenie nie istnieje.")

    inviter_id = inv.inviter_id
    event_id = inv.event_id
    db.delete(inv)
    db.commit()

    ev = db.query(Event).filter(Event.id == event_id).first()
    create_notification(
        db=db,
        user_id=inviter_id,
        notif_type="event_invitation_declined",
        message=f"{current_user.username} odrzucił zaproszenie do „{ev.title if ev else 'wydarzenia'}”."
    )
    await manager.send_to_user(inviter_id, {"type": "event_invitation_resolved"})
    return {"message": "Zaproszenie odrzucone."}


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

    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
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
    participant = get_participant(db, event_id=event_id, user_id=current_user.id)
    if not participant:
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego wydarzenia.")

    # Twarda walidacja (suma shares == amount, uczestnictwo, dodatnie kwoty, brak duplikatów,
    # spłata ≤ aktualny dług) jest wewnątrz create_expense.
    new_expense = create_expense(db=db, event_id=event_id, payer_id=current_user.id, expense_data=expense)

    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
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



# --- FINANSE: SPŁATA POJEDYNCZEGO UDZIAŁU ---
@router.post("/{event_id}/shares/{share_id}/settle", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def settle_single_share(
        event_id: int,
        share_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Oznacza pojedynczy zakup jako spłacony — tworzy wpis audytowy w logu spłat."""
    audit = settle_share(db=db, event_id=event_id, share_id=share_id, user_id=current_user.id)
    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return audit


# --- FINANSE: SPŁATA WSZYSTKICH DŁUGÓW WOBEC KONKRETNEGO WIERZYCIELA ---
@router.post("/{event_id}/creditors/{creditor_id}/settle-all", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def settle_all_with_user(
        event_id: int,
        creditor_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user),
):
    """Spłaca wszystkie otwarte długi zalogowanego usera wobec wskazanej osoby (zbiorczy wpis)."""
    audit = settle_all_with_creditor(db=db, event_id=event_id, user_id=current_user.id, creditor_id=creditor_id)
    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return audit


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
async def add_sub_event(event_id: int, sub_event: SubEventCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_sub = create_sub_event(db=db, event_id=event_id, sub_event=sub_event)
    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return new_sub


# Edycja wydarzenia
@router.put("/{event_id}", response_model=EventResponse)
async def edit_event(event_id: int, event_update: EventUpdate, db: Session = Depends(get_db),
                     current_user: User = Depends(get_current_user)):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event or db_event.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Brak uprawnień do edycji")

    updated = update_event(db, event_id, event_update)
    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return updated


# Usuwanie wydarzenia
@router.delete("/{event_id}")
async def remove_event(event_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event or db_event.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    # Najpierw zbierz user_id uczestników (po usunięciu event_participants już nie będzie)
    participant_ids = [p.user_id for p in db.query(EventParticipant.user_id).filter(
        EventParticipant.event_id == event_id
    ).all()]

    delete_event(db, event_id)

    await manager.broadcast_to_users(
        participant_ids,
        {"type": "event_deleted", "event_id": event_id}
    )
    return {"message": "Wydarzenie usunięte"}

# Edycja SubEventu
@router.put("/sub-events/{sub_event_id}", response_model=SubEventResponse)
async def edit_sub_event(sub_event_id: int, sub_update: SubEventUpdate, db: Session = Depends(get_db)):
    updated = update_sub_event(db, sub_event_id, sub_update)
    if updated:
        await manager.broadcast_to_event(updated.event_id, {"type": "event_updated", "event_id": updated.event_id}, db)
    return updated


# Usuwanie SubEventu
@router.delete("/sub-events/{sub_event_id}")
async def remove_sub_event(sub_event_id: int, db: Session = Depends(get_db)):
    db_sub = db.query(SubEvent).filter(SubEvent.id == sub_event_id).first()
    if db_sub:
        event_id = db_sub.event_id
        delete_sub_event(db, sub_event_id)
        await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return {"message": "Punkt usunięty"}


@router.delete("/{event_id}/participants/{user_id}")
async def remove_participant(event_id: int, user_id: int, db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):

    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Wydarzenie nie znalezione")

    is_organizer = db_event.creator_id == current_user.id or getattr(db_event, 'owner_id', None) == current_user.id

    # Tylko organizator wyrzuca innych, ale każdy wyrzuca siebie
    if not is_organizer and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Brak uprawnień")

    # Sprawdzenie niespłaconych długów
    unsettled = (
        db.query(ExpenseShare)
        .join(Expense, ExpenseShare.expense_id == Expense.id)
        .filter(
            Expense.event_id == event_id,
            ExpenseShare.user_id == user_id,
            ExpenseShare.is_settled.is_(False),
            Expense.payer_id != user_id,
        )
        .first()
    )
    if unsettled:
        if not is_organizer:
            raise HTTPException(
                status_code=400,
                detail="Nie możesz opuścić wydarzenia z niespłaconymi długami. Rozlicz się przed wyjściem."
            )
        # Organizator wyrzuca — powiadom usuwanego o długach
        create_notification(
            db=db,
            user_id=user_id,
            notif_type="debt_warning",
            message=f"Zostałeś usunięty z wydarzenia „{db_event.title}" przez organizatora. Masz niespłacone długi w tym wydarzeniu."
        )
        await manager.send_to_user(user_id, {"type": "debt_warning"})

    participant = db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == user_id
    ).first()

    if participant:
        db.delete(participant)
        db.commit()

        if db_event.creator_id == user_id or getattr(db_event, 'owner_id', None) == user_id:
            # Szukamy kogoś, kto został
            next_participant = db.query(EventParticipant).filter(EventParticipant.event_id == event_id).first()
            if next_participant:
                # Przekazujemy władzę
                db_event.creator_id = next_participant.user_id
                if hasattr(db_event, 'owner_id'):
                    db_event.owner_id = next_participant.user_id
                db.commit()
            else:
                # Nikogo nie ma - kasujemy wydarzenie (opcjonalnie)
                db.delete(db_event)
                db.commit()

        await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
        # Powiadom usuniętego usera, żeby zaktualizował swój dashboard
        await manager.send_to_user(user_id, {"type": "event_updated", "event_id": event_id})

    return {"message": "Uczestnik usunięty z wydarzenia"}


@router.put("/{event_id}/transfer-ownership/{new_owner_id}")
async def transfer_ownership(event_id: int, new_owner_id: int, db: Session = Depends(get_db),
                             current_user: User = Depends(get_current_user)):

    db_event = db.query(Event).filter(Event.id == event_id).first()
    if not db_event:
        raise HTTPException(status_code=404, detail="Wydarzenie nie znalezione")

    is_organizer = db_event.creator_id == current_user.id or getattr(db_event, 'owner_id', None) == current_user.id
    if not is_organizer:
        raise HTTPException(status_code=403, detail="Tylko organizator może przekazać uprawnienia")

    new_participant = db.query(EventParticipant).filter(EventParticipant.event_id == event_id,
                                                        EventParticipant.user_id == new_owner_id).first()
    if not new_participant:
        raise HTTPException(status_code=400, detail="Nowy organizator musi być uczestnikiem wyjazdu")

    db_event.creator_id = new_owner_id
    if hasattr(db_event, 'owner_id'):
        db_event.owner_id = new_owner_id

    db.commit()
    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return {"message": "Uprawnienia przekazane pomyślnie"}