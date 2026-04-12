from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional

# Baza: Co wspólnego ma tworzenie i odczytywanie wydarzenia?
class EventBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=100, description="Tytuł wydarzenia")
    description: Optional[str] = Field(None, description="Opcjonalny opis")

# Co przyjmujemy z Frontendu? (Tylko tytuł i opis)
class EventCreate(EventBase):
    pass

# Co wysyłamy do Frontendu? (Dodajemy ID, ID twórcy i datę utworzenia)
class EventResponse(EventBase):
    id: int
    creator_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)