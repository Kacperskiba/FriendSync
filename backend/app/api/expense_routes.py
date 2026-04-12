from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseResponse
from app.crud import expense as expense_crud

router = APIRouter(prefix="/api/expenses", tags=["Expenses"])

@router.post("/event/{event_id}", response_model=ExpenseResponse)
def add_expense(
    event_id: int,
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dodaje nowy wydatek do wydarzenia i dzieli go między osoby."""
    return expense_crud.create_expense(db, expense_in, event_id, current_user.id)

@router.get("/event/{event_id}", response_model=List[ExpenseResponse])
def list_expenses(event_id: int, db: Session = Depends(get_db)):
    """Pobiera historię wydatków dla danego wydarzenia."""
    return expense_crud.get_event_expenses(db, event_id)