from sqlalchemy.orm import Session
from app.models.notification import Notification

def create_notification(db: Session, user_id: int, notif_type: str, message: str):
    """Tworzy nowe powiadomienie w bazie."""
    new_notif = Notification(user_id=user_id, type=notif_type, message=message)
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    return new_notif

def get_user_notifications(db: Session, user_id: int, unread_only: bool = False):
    """Pobiera powiadomienia dla użytkownika."""
    query = db.query(Notification).filter(Notification.user_id == user_id)
    if unread_only:
        query = query.filter(Notification.is_read == False)
    # Najnowsze na samej górze
    return query.order_by(Notification.created_at.desc()).all()

def mark_notification_as_read(db: Session, notification_id: int, user_id: int):
    """Zaznacza powiadomienie jako przeczytane."""
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return notif

def delete_all_notifications(db: Session, user_id: int) -> int:
    """Usuwa wszystkie powiadomienia użytkownika. Zwraca liczbę usuniętych."""
    count = db.query(Notification).filter(Notification.user_id == user_id).delete()
    db.commit()
    return count