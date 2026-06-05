from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.core.database import Base

class SubEvent(Base):
    __tablename__ = "sub_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    start_time = Column(DateTime, nullable=True)

    # Opcjonalne podpięcie punktu z mapy wyjazdu. SET NULL — gdy lokalizacja
    # zostanie usunięta, podpunkt po prostu traci powiązanie (nie znika).
    location_id = Column(Integer, ForeignKey("location_proposals.id", ondelete="SET NULL"), nullable=True)

    # Relacja zwrotna do głównego wydarzenia
    event = relationship("Event", back_populates="sub_events")
    # Powiązany punkt na mapie (jednokierunkowo).
    location = relationship("LocationProposal")