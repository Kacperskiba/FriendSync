from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class LocationProposal(Base):
    __tablename__ = "location_proposals"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relacje
    event = relationship("Event", back_populates="locations")
    creator = relationship("User", back_populates="proposed_locations")
    votes = relationship("LocationVote", back_populates="location")

class LocationVote(Base):
    __tablename__ = "location_votes"

    id = Column(Integer, primary_key=True, index=True)
    location_id = Column(Integer, ForeignKey("location_proposals.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    # Wartość głosu (np. 1 dla 'za', lub system punktowy)
    vote_value = Column(Integer, default=1)

    # Relacje
    location = relationship("LocationProposal", back_populates="votes")
    user = relationship("User", back_populates="location_votes")