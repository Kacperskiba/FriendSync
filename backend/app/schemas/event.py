from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class EventBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=100)
    description: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventResponse(EventBase):
    id: int
    creator_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class EventParticipantBase(BaseModel):
    user_id: int
    event_id: int
    role: str = "member"

class EventParticipantResponse(EventParticipantBase):
    id: int
    joined_at: datetime

    class Config:
        from_attributes = True