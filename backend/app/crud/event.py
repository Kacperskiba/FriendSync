from sqlalchemy.orm import Session
from app.models.event import Event, EventParticipant
from app.schemas.event import EventCreate


def create_event(db: Session, event_in: EventCreate, creator_id: int):
    # 1. Tworzymy wydarzenie
    db_event = Event(
        title=event_in.title,
        description=event_in.description,
        creator_id=creator_id
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    # 2. Automatycznie dodajemy twórcę jako uczestnika z rolą 'admin'
    participant = EventParticipant(
        event_id=db_event.id,
        user_id=creator_id,
        role="admin"
    )
    db.add(participant)
    db.commit()

    return db_event


def get_events_for_user(db: Session, user_id: int):
    # Pobiera wydarzenia, w których użytkownik bierze udział
    return db.query(Event).join(EventParticipant).filter(EventParticipant.user_id == user_id).all()


def get_event_by_id(db: Session, event_id: int):
    return db.query(Event).filter(Event.id == event_id).first()