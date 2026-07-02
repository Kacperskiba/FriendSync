import secrets

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


def generate_invite_token() -> str:
    """Kryptograficznie losowy token do linku zaproszeniowego (URL-safe)."""
    return secrets.token_urlsafe(24)


class EventInviteLink(Base):
    __tablename__ = "event_invite_links"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    token = Column(String(64), unique=True, index=True, nullable=False, default=generate_invite_token)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)   # kto wygenerował link
    is_active = Column(Boolean, default=True, nullable=False)              # False = link unieważniony
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)            # NULL = bezterminowy

    event = relationship("Event")
    creator = relationship("User")
