from sqlalchemy import Column, Integer, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class DateProposal(Base):
    __tablename__ = "date_proposals"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    proposed_date = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    event = relationship("Event", back_populates="date_proposals")
    creator = relationship("User")
    # Kaskada: usunięcie propozycji usuwa też powiązane głosy.
    votes = relationship("DateVote", back_populates="proposal", cascade="all, delete-orphan")


class DateVote(Base):
    __tablename__ = "date_votes"
    # Jeden użytkownik może zagłosować na daną propozycję tylko raz.
    __table_args__ = (UniqueConstraint("proposal_id", "user_id", name="uq_date_vote_proposal_user"),)

    id = Column(Integer, primary_key=True, index=True)
    proposal_id = Column(Integer, ForeignKey("date_proposals.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    proposal = relationship("DateProposal", back_populates="votes")
    user = relationship("User")
