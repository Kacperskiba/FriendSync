from http.client import HTTPException
from operator import or_

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.user import User
from app.api.dependencies import get_current_user
from app.schemas.friendship import FriendRequestCreate, FriendUserResponse, PendingRequestResponse
from app.crud.friendship import send_friend_request, accept_friend_request, get_friends, get_pending_requests
from app.api.websocket import manager
from app.models.friendship import Friendship

router = APIRouter(
    prefix="/api/friends",
    tags=["Friends"]
)


def serialize_friend(user: User) -> FriendUserResponse:
    """
    Buduje FriendUserResponse z is_online opartym na aktywnych połączeniach WS.
    Online = zalogowany i ma otwarty WebSocket. Offline = wylogowany lub zamknięta karta.
    """
    return FriendUserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        profile_image=user.profile_image,
        bio=user.bio,
        tags=user.tags,
        is_online=manager.is_user_online(user.id)
    )


@router.post("/request", status_code=status.HTTP_201_CREATED)
async def add_friend(
        request: FriendRequestCreate,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    new_request = send_friend_request(db, current_user.id, request.friend_identifier)
    await manager.send_to_user(new_request.friend_id, {"type": "friend_request_new"})
    return new_request


@router.post("/{friendship_id}/accept", status_code=status.HTTP_200_OK)
async def accept_friend(
        friendship_id: int,
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    accepted_request = accept_friend_request(db, friendship_id, current_user.id)
    await manager.send_to_user(accepted_request.user_id, {"type": "friend_request_accepted"})
    return accepted_request


@router.get("", response_model=List[FriendUserResponse])
def list_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    friends = get_friends(db, current_user.id)
    return [serialize_friend(f) for f in friends]


@router.get("/pending", response_model=List[PendingRequestResponse])
def list_pending_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pending = get_pending_requests(db, current_user.id)
    return [
        PendingRequestResponse(
            friendship_id=p["friendship_id"],
            user=serialize_friend(p["user"])
        )
        for p in pending
    ]


@router.get("/search-users")
def search_users(q: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if len(q) < 2:
        return []

    users = db.query(User).filter(
        (User.id != current_user.id) &
        (User.username.ilike(f"%{q}%") | User.email.ilike(f"%{q}%"))
    ).limit(5).all()

    return [
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "profile_image": getattr(u, 'profile_image', None)
        } for u in users
    ]


@router.delete("/{friend_id}")
async def remove_friend(friend_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    from fastapi import HTTPException as FastHTTPException
    friendship = db.query(Friendship).filter(
        or_(
            (Friendship.user_id == current_user.id) & (Friendship.friend_id == friend_id),
            (Friendship.user_id == friend_id) & (Friendship.friend_id == current_user.id)
        )
    ).first()

    if not friendship:
        raise FastHTTPException(status_code=404, detail="Nie znaleziono znajomości")

    db.delete(friendship)
    db.commit()
    await manager.send_to_user(friend_id, {"type": "friend_removed", "user_id": current_user.id})
    return {"message": "Znajomy usunięty"}