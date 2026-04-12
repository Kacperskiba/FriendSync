from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import List, Optional

# --- PODZIAŁ RACHUNKU (Kto ile ma oddać) ---
class ExpenseShareCreate(BaseModel):
    user_id: int = Field(..., description="ID użytkownika, który jest winny pieniądze")
    amount: float = Field(..., gt=0, description="Kwota, jaką ta osoba musi oddać")

class ExpenseShareResponse(ExpenseShareCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)

# --- GŁÓWNY WYDATEK (Kto założył pieniądze) ---
class ExpenseCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Całkowita kwota wydatku")
    description: Optional[str] = Field(None, max_length=255, description="Za co to było?")
    # Lista z podziałem długu zdefiniowana wyżej!
    shares: List[ExpenseShareCreate]

class ExpenseResponse(BaseModel):
    id: int
    event_id: int
    payer_id: int
    amount: float
    description: Optional[str]
    created_at: datetime
    # Zwracamy wydatek od razu z przypisanymi do niego długami
    shares: List[ExpenseShareResponse]

    model_config = ConfigDict(from_attributes=True)

# --- PODSUMOWANIE DŁUGÓW ---
class DebtSettlement(BaseModel):
    from_user_id: int = Field(..., description="Kto musi przelać pieniądze")
    to_user_id: int = Field(..., description="Komu musi przelać")
    amount: float = Field(..., description="Kwota przelewu")

class FinanceSummaryResponse(BaseModel):
    event_id: int
    total_event_cost: float = Field(..., description="Ile łącznie wydano na całym wyjeździe")
    settlements: List[DebtSettlement] = Field(..., description="Lista przelewów do wyrównania rachunków")