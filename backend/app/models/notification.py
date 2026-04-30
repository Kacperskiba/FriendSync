from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id")) # Odbiorca powiadomienia
    type = Column(String)                             # np. 'friend_request', 'event_invite'
    message = Column(String)                          # np. "Jan zaprasza Cię do znajomych"
    is_read = Column(Boolean, default=False)          # Czy przeczytane?
    created_at = Column(DateTime(timezone=True), server_default=func.now())