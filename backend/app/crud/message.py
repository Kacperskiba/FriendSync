from sqlalchemy.orm import Session
from app.models.message import Message

def create_message(db: Session, content: str, event_id: int, author_id: int):
    db_message = Message(
        content=content,
        event_id=event_id,
        author_id=author_id
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def get_event_messages(db: Session, event_id: int, limit: int = 50):
    return db.query(Message).filter(Message.event_id == event_id).order_by(Message.created_at.desc()).limit(limit).all()