from pydantic import BaseModel
from datetime import datetime

class MessageCreate(BaseModel):
    content: str

class MessageResponse(BaseModel):
    id: int
    event_id: int
    author_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True