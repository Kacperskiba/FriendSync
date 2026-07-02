from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    # timezone=True — daty przechowujemy jako timestamptz (UTC); frontend wysyła ISO z 'Z',
    # a naiwna kolumna gubiła strefę i każda edycja przesuwała godzinę o lokalny offset.
    event_date = Column(DateTime(timezone=True), nullable=True)
    # Relacje - SPRAWDŹ TE LINIE:
    creator = relationship("User", back_populates="created_events")

    # Kaskada: usunięcie wydarzenia = usunięcie przypisanych do niego danych
    participants = relationship("EventParticipant", back_populates="event", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="event", cascade="all, delete-orphan")
    locations = relationship("LocationProposal", back_populates="event", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="event", cascade="all, delete-orphan")
    sub_events = relationship("SubEvent", back_populates="event", cascade="all, delete-orphan")
    date_proposals = relationship("DateProposal", back_populates="event", cascade="all, delete-orphan")

class EventParticipant(Base):
    __tablename__ = "event_participants"

    id = Column(Integer, primary_key=True, index=True)

    # Połączenie konkretnego wydarzenia z konkretnym użytkownikiem
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Rola użytkownika w wydarzeniu (np. "admin", "member")
    role = Column(String(50), default="member")

    joined_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacje
    event = relationship("Event", back_populates="participants")
    user = relationship("User", back_populates="participations")
