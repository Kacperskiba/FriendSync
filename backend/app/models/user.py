from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship # --- NOWY IMPORT ---
from app.core.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # --- NOWE RELACJE ---
    created_events = relationship("Event", back_populates="creator")
    participations = relationship("EventParticipant", back_populates="user")
    payments = relationship("Expense", back_populates="payer")
    expense_shares = relationship("ExpenseShare", back_populates="user")
    proposed_locations = relationship("LocationProposal", back_populates="creator")
    location_votes = relationship("LocationVote", back_populates="user")
    messages = relationship("Message", back_populates="author")