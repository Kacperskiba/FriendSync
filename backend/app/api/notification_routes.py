from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.models.user import User
from app.api.dependencies import get_current_user
from app.schemas.notification import NotificationResponse
from app.crud.notification import get_user_notifications, mark_notification_as_read

router = APIRouter(prefix="/api/notifications", tags=["Notifications"])

@router.get("", response_model=List[NotificationResponse])
def get_my_notifications(unread_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return get_user_notifications(db, current_user.id, unread_only)

@router.put("/{notification_id}/read", status_code=status.HTTP_200_OK)
def mark_as_read(notification_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mark_notification_as_read(db, notification_id, current_user.id)
    return {"message": "Oznaczono jako przeczytane"}