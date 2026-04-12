from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class LocationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    latitude: float
    longitude: float

class LocationCreate(LocationBase):
    pass

class LocationVoteResponse(BaseModel):
    user_id: int
    vote_value: int

    class Config:
        from_attributes = True

class LocationResponse(LocationBase):
    id: int
    event_id: int
    creator_id: int
    created_at: datetime
    votes_count: int = 0  # Suma głosów

    class Config:
        from_attributes = True