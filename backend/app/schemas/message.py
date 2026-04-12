from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime

# To wysyła React (tylko treść)
class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000, description="Treść wiadomości")

# To zwraca serwer (wszystkie szczegóły)
class MessageResponse(BaseModel):
    id: int
    event_id: int
    author_id: int
    content: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)