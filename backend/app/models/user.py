from sqlalchemy.orm import relationship
from app.core.database import Base
from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text
from sqlalchemy.sql import func
from datetime import datetime, timedelta


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    profile_image = Column(String(255), nullable=True)

    bio = Column(Text, nullable=True)
    tags = Column(String(255), nullable=True)

    # last_active zostaje dla celów audytowych, ale NIE określa już statusu online.
    # Status online = czy użytkownik ma aktywne połączenie WebSocket (manager.is_user_online)
    last_active = Column(DateTime(timezone=True), server_default=func.now())

    # USUNIĘTO: property is_online bazujące na last_active
    # Powodowało że każde kliknięcie w app (onupdate) resetowało zegar
    # i user nigdy nie przechodził w offline mimo braku aktywności.

    created_events = relationship("Event", back_populates="creator")
    participations = relationship("EventParticipant", back_populates="user")
    payments = relationship("Expense", back_populates="payer")
    expense_shares = relationship("ExpenseShare", back_populates="user")
    proposed_locations = relationship("LocationProposal", back_populates="creator")
    location_votes = relationship("LocationVote", back_populates="user")
    messages = relationship("Message", back_populates="author")