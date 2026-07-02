from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.core.database import Base


class PasswordResetToken(Base):
    """Jednorazowy token resetu hasła.

    W bazie przechowujemy wyłącznie hash SHA-256 tokenu — sam token trafia
    tylko do e-maila użytkownika, więc wyciek bazy nie daje działających linków.
    """
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash = Column(String(64), unique=True, index=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)   # NULL = jeszcze nieużyty

    user = relationship("User")
