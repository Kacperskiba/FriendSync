from typing import Optional

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Treść wiadomości")

class MessageAuthor(BaseModel):
    id: int
    username: str
    profile_image: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class MessageResponse(BaseModel):
    id: int
    event_id: int
    author_id: int
    content: str
    created_at: datetime
    author: MessageAuthor

    model_config = ConfigDict(from_attributes=True)