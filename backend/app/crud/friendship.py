from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.friendship import Friendship
from app.models.user import User
from app.crud.notification import create_notification


def send_friend_request(db: Session, user_id: int, friend_email: str):
    # Pobieramy dane nadawcy, żeby użyć jego nazwy w powiadomieniu
    sender = db.query(User).filter(User.id == user_id).first()

    # Szukamy odbiorcy po emailu
    friend = db.query(User).filter(User.email == friend_email).first()

    if not friend:
        raise HTTPException(status_code=404, detail="Użytkownik z tym adresem email nie istnieje.")
    if friend.id == user_id:
        raise HTTPException(status_code=400, detail="Nie możesz zaprosić samego siebie.")

    # Sprawdzamy, czy relacja już istnieje w którąkolwiek stronę
    existing = db.query(Friendship).filter(
        ((Friendship.user_id == user_id) & (Friendship.friend_id == friend.id)) |
        ((Friendship.user_id == friend.id) & (Friendship.friend_id == user_id))
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="Zaproszenie już istnieje lub jesteście już znajomymi.")

    # Zapisujemy zaproszenie do bazy
    new_req = Friendship(user_id=user_id, friend_id=friend.id, status="pending")
    db.add(new_req)
    db.commit()
    db.refresh(new_req)

    # --- MAGIA POWIADOMIEŃ ---
    # Wysyłamy powiadomienie do osoby, którą zapraszamy (friend.id)
    create_notification(
        db=db,
        user_id=friend.id,
        notif_type="friend_request",
        message=f"{sender.username} wysłał Ci zaproszenie do znajomych!"
    )

    return {"message": "Zaproszenie wysłane pomyślnie!"}


def accept_friend_request(db: Session, friendship_id: int, user_id: int):
    # Szukamy zaproszenia, w którym JA jestem odbiorcą ('friend_id') i ma status 'pending'
    req = db.query(Friendship).filter(
        Friendship.id == friendship_id,
        Friendship.friend_id == user_id,
        Friendship.status == "pending"
    ).first()

    if not req:
        raise HTTPException(status_code=404, detail="Nie znaleziono zaproszenia do akceptacji.")

    req.status = "accepted"
    db.commit()

    # Opcjonalnie: Powiadomienie dla nadawcy, że zaakceptowaliśmy zaproszenie!
    acceptor = db.query(User).filter(User.id == user_id).first()
    create_notification(
        db=db,
        user_id=req.user_id,  # Wysyłamy do tego, kto pierwotnie wysłał zaproszenie
        notif_type="friend_accepted",
        message=f"{acceptor.username} zaakceptował Twoje zaproszenie do znajomych!"
    )

    return {"message": "Zaproszenie zaakceptowane!"}


def get_friends(db: Session, user_id: int):
    # Pobieramy relacje, w których biorę udział i mają status 'accepted'
    friendships = db.query(Friendship).filter(
        ((Friendship.user_id == user_id) | (Friendship.friend_id == user_id)),
        Friendship.status == "accepted"
    ).all()

    friends = []
    for f in friendships:
        # Wyłuskujemy ID naszego znajomego
        friend_id = f.friend_id if f.user_id == user_id else f.user_id
        friend_user = db.query(User).filter(User.id == friend_id).first()
        if friend_user:
            friends.append(friend_user)
    return friends


def get_pending_requests(db: Session, user_id: int):
    # Pobieramy zaproszenia, które ktoś wysłał DO MNIE
    requests = db.query(Friendship, User).join(User, Friendship.user_id == User.id).filter(
        Friendship.friend_id == user_id,
        Friendship.status == "pending"
    ).all()

    return [{"friendship_id": f.id, "user": u} for f, u in requests]