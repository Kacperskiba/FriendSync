from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional, List


class SubEventLocation(BaseModel):
    id: int
    name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class SubEventCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    location_id: Optional[int] = None


class SubEventResponse(BaseModel):
    id: int
    event_id: int
    title: str
    description: Optional[str]
    start_time: Optional[datetime]
    location_id: Optional[int] = None
    location: Optional[SubEventLocation] = None

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
    location_id: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class InviterMini(BaseModel):
    id: int
    username: str
    profile_image: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class EventMini(BaseModel):
    id: int
    title: str
    event_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class EventInvitationResponse(BaseModel):
    id: int
    event: EventMini
    inviter: InviterMini
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)