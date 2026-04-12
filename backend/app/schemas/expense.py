from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List

class ExpenseShareBase(BaseModel):
    user_id: int
    amount: float

class ExpenseShareCreate(ExpenseShareBase):
    pass

class ExpenseCreate(BaseModel):
    amount: float
    description: Optional[str] = None
    # Lista udziałów (kto ile jest winien z tego rachunku)
    shares: List[ExpenseShareCreate]

class ExpenseResponse(BaseModel):
    id: int
    event_id: int
    payer_id: int
    amount: float
    description: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True