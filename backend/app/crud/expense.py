from app.schemas.expense import ExpenseCreate
from sqlalchemy.orm import Session
from app.models.expense import Expense, ExpenseShare


def create_expense(db: Session, expense_in: ExpenseCreate, event_id: int, payer_id: int):
    # 1. Tworzymy główny rekord wydatku
    db_expense = Expense(
        event_id=event_id,
        payer_id=payer_id,
        amount=expense_in.amount,
        description=expense_in.description
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)

    # 2. Tworzymy udziały dla każdej osoby wskazanej w shares
    for share in expense_in.shares:
        db_share = ExpenseShare(
            expense_id=db_expense.id,
            user_id=share.user_id,
            amount=share.amount
        )
        db.add(db_share)

    db.commit()
    return db_expense


def get_event_expenses(db: Session, event_id: int):
    return db.query(Expense).filter(Expense.event_id == event_id).all()