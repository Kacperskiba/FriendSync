from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.api.dependencies import get_current_user
from app.schemas.friendship import FriendRequestCreate, FriendUserResponse, PendingRequestResponse
from app.crud.friendship import send_friend_request, accept_friend_request, get_friends, get_pending_requests

router = APIRouter(
    prefix="/api/friends",
    tags=["Friends"]
)

@router.post("/request", status_code=status.HTTP_201_CREATED)
def add_friend(request: FriendRequestCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return send_friend_request(db, current_user.id, request.friend_email)

@router.post("/{friendship_id}/accept", status_code=status.HTTP_200_OK)
def accept_friend(friendship_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return accept_friend_request(db, friendship_id, current_user.id)

@router.get("", response_model=List[FriendUserResponse])
def list_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_friends(db, current_user.id)

@router.get("/pending", response_model=List[PendingRequestResponse])
def list_pending_requests(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_pending_requests(db, current_user.id)