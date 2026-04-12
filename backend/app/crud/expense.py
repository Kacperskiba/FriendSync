from sqlalchemy.orm import Session
from app.models.expense import Expense, ExpenseShare
from app.schemas.expense import ExpenseCreate
from collections import defaultdict
from app.schemas.expense import DebtSettlement

def create_expense(db: Session, event_id: int, payer_id: int, expense_data: ExpenseCreate):
    """Zapisuje wydatek i od razu dzieli go na udziały (długi)."""

    # 1. Zapisujemy główny wydatek
    db_expense = Expense(
        event_id=event_id,
        payer_id=payer_id,
        amount=expense_data.amount,
        description=expense_data.description
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)  # Pobieramy jego ID z bazy

    # 2. Tworzymy długi (shares) dla poszczególnych osób
    for share in expense_data.shares:
        db_share = ExpenseShare(
            expense_id=db_expense.id,  # Przypinamy dług do paragonu wyżej
            user_id=share.user_id,
            amount=share.amount
        )
        db.add(db_share)

    db.commit()  # Zapisujemy wszystkie długi na raz
    db.refresh(db_expense)  # Odświeżamy wydatek, żeby załadował swoje nowe 'shares'

    return db_expense


def get_event_expenses(db: Session, event_id: int):
    """Pobiera wszystkie wydatki dla danego wydarzenia."""
    return db.query(Expense).filter(Expense.event_id == event_id).all()


def calculate_finance_summary(db: Session, event_id: int):
    """Oblicza bilans i generuje najprostszą listę przelewów do wyrównania długów."""
    expenses = get_event_expenses(db, event_id)

    # 1. Liczymy saldo każdego użytkownika (Kto jest "na plusie", a kto "na minusie")
    balances = defaultdict(float)
    total_cost = 0.0

    for exp in expenses:
        total_cost += exp.amount
        balances[exp.payer_id] += exp.amount  # Płatnik ma "plus" (ktoś mu wisi)

        for share in exp.shares:
            balances[share.user_id] -= share.amount  # Dłużnik ma "minus"

    # 2. Dzielimy ludzi na tych co muszą oddać (Dłużnicy) i tych co muszą dostać (Wierzyciele)
    debtors = [{"user_id": uid, "amount": abs(bal)} for uid, bal in balances.items() if bal < -0.01]
    creditors = [{"user_id": uid, "amount": bal} for uid, bal in balances.items() if bal > 0.01]

    # Sortujemy od największych kwot, żeby zoptymalizować przelewy
    debtors.sort(key=lambda x: x["amount"], reverse=True)
    creditors.sort(key=lambda x: x["amount"], reverse=True)

    # 3. Zdejmujemy długi ("parujemy" dłużników z wierzycielami)
    settlements = []
    i, j = 0, 0

    while i < len(debtors) and j < len(creditors):
        debtor = debtors[i]
        creditor = creditors[j]

        # Przelewamy mniejszą z dwóch kwot (albo spłacamy cały dług, albo oddajemy wszystko co wierzycielowi się należy)
        amount = min(debtor["amount"], creditor["amount"])

        settlements.append(DebtSettlement(
            from_user_id=debtor["user_id"],
            to_user_id=creditor["user_id"],
            amount=round(amount, 2)
        ))

        # Aktualizujemy salda w locie
        debtors[i]["amount"] -= amount
        creditors[j]["amount"] -= amount

        if debtors[i]["amount"] < 0.01:
            i += 1
        if creditors[j]["amount"] < 0.01:
            j += 1

    return {
        "event_id": event_id,
        "total_event_cost": round(total_cost, 2),
        "settlements": settlements
    }
