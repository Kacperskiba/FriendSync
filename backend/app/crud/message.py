from sqlalchemy.orm import Session, joinedload # <--- DODANO joinedload
from app.models.message import Message
from app.schemas.message import MessageCreate

def create_message(db: Session, event_id: int, user_id: int, message: MessageCreate):
    """Zapisuje nową wiadomość w bazie."""
    db_message = Message(
        event_id=event_id,
        author_id=user_id,
        content=message.content
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_event_messages(db: Session, event_id: int):
    """Pobiera wiadomości WRAZ z danymi autora."""
    # Używamy .options(joinedload(...)), aby baza od razu dociągnęła nazwę użytkownika
    return db.query(Message).options(joinedload(Message.author)).filter(Message.event_id == event_id).order_by(Message.created_at.asc()).all()