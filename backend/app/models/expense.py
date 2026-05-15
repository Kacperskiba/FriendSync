from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    payer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Float, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacje
    event = relationship("Event", back_populates="expenses")
    payer = relationship("User", back_populates="payments")
    shares = relationship("ExpenseShare", back_populates="expense")

class ExpenseShare(Base):
    __tablename__ = "expense_shares"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Ile konkretnie ta osoba jest winna z tego rachunku
    amount = Column(Float, nullable=False)
    # Czy ten konkretny udział został już spłacony (flag-based settlement).
    is_settled = Column(Boolean, nullable=False, server_default="false", default=False)
    settled_at = Column(DateTime(timezone=True), nullable=True)

    # Relacje
    expense = relationship("Expense", back_populates="shares")
    user = relationship("User", back_populates="expense_shares")
