from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class LocationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None

class LocationCreate(LocationBase):
    address: Optional[str] = None

class LocationResponse(LocationBase):
    id: int
    event_id: int
    creator_id: int
    created_at: datetime
    votes_count: int = 0

    class Config:
        from_attributes = True

class VoteCreate(BaseModel):
    vote_value: int = Field(..., description="1 dla upvote, -1 dla downvote")