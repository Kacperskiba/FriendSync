from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List


class SubEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None


class SubEventResponse(BaseModel):
    id: int
    event_id: int
    title: str
    description: Optional[str]
    start_time: Optional[datetime]

    model_config = ConfigDict(from_attributes=True)


class EventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    event_date: Optional[datetime] = None


class EventResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    event_date: Optional[datetime]
    creator_id: int
    created_at: datetime

    sub_events: List[SubEventResponse] = []

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[datetime] = None

class SubEventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)