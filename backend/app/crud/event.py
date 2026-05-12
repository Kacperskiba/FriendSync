from sqlalchemy.orm import Session
from app.models.event import Event, EventParticipant
from app.schemas.event import EventCreate
from app.models.sub_event import SubEvent
from app.schemas.event import EventCreate, EventUpdate, SubEventCreate, SubEventUpdate

def create_event(db: Session, event: EventCreate, user_id: int):
    """Tworzy nowe wydarzenie i automatycznie przypisuje twórcę jako uczestnika-admina."""

    # 1. Tworzymy samo wydarzenie
    db_event = Event(
        title=event.title,
        event_date=event.event_date,
        description=event.description,
        creator_id=user_id
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)  # Odświeżamy, żeby poznać ID nowo utworzonego wydarzenia

    # 2. Dodajemy twórcę do tabeli uczestników
    db_participant = EventParticipant(
        event_id=db_event.id,
        user_id=user_id,
        role="admin"  # Twórca automatycznie jest adminem
    )
    db.add(db_participant)
    db.commit()

    return db_event


def get_user_events(db: Session, user_id: int):
    """Pobiera wszystkie wydarzenia, do których przypisany jest dany użytkownik."""

    # Robimy "Join" (łączenie tabel). Szukamy w tabeli Wydarzeń,
    # ale tylko tam, gdzie w tabeli Uczestników widnieje ID naszego użytkownika.
    return db.query(Event).join(EventParticipant).filter(EventParticipant.user_id == user_id).all()

# Upewnij się, że na górze pliku masz zaimportowany również model Użytkownika
# from app.models.user import User

def get_event(db: Session, event_id: int):
    """Pobiera pojedyncze wydarzenie po jego ID."""
    return db.query(Event).filter(Event.id == event_id).first()

def get_participant(db: Session, event_id: int, user_id: int):
    """Sprawdza, czy dany użytkownik jest już w tym wydarzeniu."""
    return db.query(EventParticipant).filter(
        EventParticipant.event_id == event_id,
        EventParticipant.user_id == user_id
    ).first()

def add_user_to_event(db: Session, event_id: int, user_id: int, role: str = "member"):
    """Dodaje nowego uczestnika do wydarzenia."""
    db_participant = EventParticipant(
        event_id=event_id,
        user_id=user_id,
        role=role
    )
    db.add(db_participant)
    db.commit()
    return db_participant


def create_sub_event(db: Session, event_id: int, sub_event: SubEventCreate):
    db_sub_event = SubEvent(
        event_id=event_id,
        title=sub_event.title,
        description=sub_event.description,
        start_time=sub_event.start_time
    )
    db.add(db_sub_event)
    db.commit()
    db.refresh(db_sub_event)
    return db_sub_event

def update_event(db: Session, event_id: int, event_update: EventUpdate):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if db_event:
        for key, value in event_update.model_dump(exclude_unset=True).items():
            setattr(db_event, key, value)
        db.commit()
        db.refresh(db_event)
    return db_event

def delete_event(db: Session, event_id: int):
    db_event = db.query(Event).filter(Event.id == event_id).first()
    if db_event:
        db.delete(db_event)
        db.commit()
    return db_event

# --- SUBEVENT CRUD ---
def update_sub_event(db: Session, sub_event_id: int, sub_update: SubEventUpdate):
    db_sub = db.query(SubEvent).filter(SubEvent.id == sub_event_id).first()
    if db_sub:
        for key, value in sub_update.model_dump(exclude_unset=True).items():
            setattr(db_sub, key, value)
        db.commit()
        db.refresh(db_sub)
    return db_sub

def delete_sub_event(db: Session, sub_event_id: int):
    db_sub = db.query(SubEvent).filter(SubEvent.id == sub_event_id).first()
    if db_sub:
        db.delete(db_sub)
        db.commit()
    return db_sub