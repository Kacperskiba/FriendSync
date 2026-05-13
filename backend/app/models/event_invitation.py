from sqlalchemy import Column, Integer, String, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class EventInvitation(Base):
    __tablename__ = "event_invitations"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)        # zapraszany
    inviter_id = Column(Integer, ForeignKey("users.id"), nullable=False)     # ten kto zaprasza
    status = Column(String(20), default="pending", nullable=False)           # 'pending' / 'accepted' / 'declined'
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event")
    user = relationship("User", foreign_keys=[user_id])
    inviter = relationship("User", foreign_keys=[inviter_id])
