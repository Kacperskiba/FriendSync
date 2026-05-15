from collections import defaultdict
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.event import EventParticipant
from app.models.expense import Expense, ExpenseShare
from app.schemas.expense import DebtSettlement, ExpenseCreate


# Tolerancja jednego grosza — float() na pieniądzach zawsze ma drobne błędy,
# więc porównujemy/zaokrąglamy w granicach 0.01 PLN.
CENT = 0.01

# Konwencja: wpisy audytowe ze spłat zaczynają się tym prefiksem.
# Dzięki temu logi i bilans rozróżniają zakupy od spłat bez dodatkowej kolumny.
SETTLEMENT_PREFIX = "Rozliczenie"


def _is_settlement(exp: Expense) -> bool:
    return bool(exp.description) and exp.description.startswith(SETTLEMENT_PREFIX)


def _participant_ids(db: Session, event_id: int) -> set[int]:
    return {
        pid for (pid,) in db.query(EventParticipant.user_id)
        .filter(EventParticipant.event_id == event_id)
        .all()
    }


def _validate_expense_payload(
    db: Session,
    event_id: int,
    payer_id: int,
    expense_data: ExpenseCreate,
) -> None:
    """Twarda walidacja przed zapisem zwykłego wydatku."""
    if expense_data.description and expense_data.description.startswith(SETTLEMENT_PREFIX):
        raise HTTPException(
            status_code=400,
            detail="Opis zakupu nie może zaczynać się od 'Rozliczenie' - to prefiks zarezerwowany dla spłat.",
        )

    if expense_data.amount <= 0:
        raise HTTPException(status_code=400, detail="Kwota wydatku musi być dodatnia.")

    if not expense_data.shares:
        raise HTTPException(status_code=400, detail="Wydatek musi mieć przynajmniej jednego dłużnika.")

    for s in expense_data.shares:
        if s.amount <= 0:
            raise HTTPException(status_code=400, detail="Każdy udział musi być dodatni.")

    seen: set[int] = set()
    for s in expense_data.shares:
        if s.user_id in seen:
            raise HTTPException(status_code=400, detail="Ten sam użytkownik nie może wystąpić w shares więcej niż raz.")
        seen.add(s.user_id)

    participants = _participant_ids(db, event_id)
    if payer_id not in participants:
        raise HTTPException(status_code=403, detail="Płatnik nie jest uczestnikiem wydarzenia.")
    foreign = [s.user_id for s in expense_data.shares if s.user_id not in participants]
    if foreign:
        raise HTTPException(
            status_code=400,
            detail="Co najmniej jeden dłużnik nie jest uczestnikiem wydarzenia.",
        )

    total_shares = sum(s.amount for s in expense_data.shares)
    if abs(total_shares - expense_data.amount) > CENT:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Suma długów ({total_shares:.2f}) musi równać się kwocie wydatku "
                f"({expense_data.amount:.2f})."
            ),
        )


def create_expense(db: Session, event_id: int, payer_id: int, expense_data: ExpenseCreate):
    """Zapisuje zakup (regularny wydatek) wraz z udziałami.

    Spłaty NIE chodzą już tym endpointem — od tego są dedykowane endpointy
    settle_share / settle_all_with_creditor (poniżej).
    """
    _validate_expense_payload(db, event_id, payer_id, expense_data)

    db_expense = Expense(
        event_id=event_id,
        payer_id=payer_id,
        amount=round(expense_data.amount, 2),
        description=expense_data.description,
    )
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)

    for share in expense_data.shares:
        # Jeśli płatnik jest jednocześnie w shares — od razu oznaczamy jego udział jako spłacony,
        # bo on samemu sobie nie płaci (eliminuje sztuczne saldo 0/0).
        is_self = share.user_id == payer_id
        db.add(ExpenseShare(
            expense_id=db_expense.id,
            user_id=share.user_id,
            amount=round(share.amount, 2),
            is_settled=is_self,
            settled_at=datetime.now(timezone.utc) if is_self else None,
        ))

    db.commit()
    db.refresh(db_expense)
    return db_expense


def get_event_expenses(db: Session, event_id: int):
    return db.query(Expense).filter(Expense.event_id == event_id).all()


def _compute_event_balances(db: Session, event_id: int) -> dict[int, float]:
    """Bilans liczony per-share, ignorując shares spłacone i wpisy audytowe spłat.

    Dla każdego niespłaconego share:
      - płatnik zyskuje należność (+amount)
      - dłużnik dostaje dług (-amount)
    """
    balances: dict[int, float] = defaultdict(float)
    for exp in get_event_expenses(db, event_id):
        if _is_settlement(exp):
            continue
        for share in exp.shares:
            if share.is_settled:
                continue
            balances[exp.payer_id] += share.amount
            balances[share.user_id] -= share.amount
    return balances


def calculate_finance_summary(db: Session, event_id: int):
    """Bilans + lista zoptymalizowanych przelewów (min-cash-flow) dla niespłaconych długów."""
    expenses = get_event_expenses(db, event_id)

    total_cost = 0.0
    for exp in expenses:
        if not _is_settlement(exp):
            total_cost += exp.amount

    balances = _compute_event_balances(db, event_id)

    debtors = [{"user_id": uid, "amount": abs(bal)} for uid, bal in balances.items() if bal < -CENT]
    creditors = [{"user_id": uid, "amount": bal} for uid, bal in balances.items() if bal > CENT]
    debtors.sort(key=lambda x: x["amount"], reverse=True)
    creditors.sort(key=lambda x: x["amount"], reverse=True)

    settlements: list[DebtSettlement] = []
    i, j = 0, 0
    while i < len(debtors) and j < len(creditors):
        amount = min(debtors[i]["amount"], creditors[j]["amount"])
        settlements.append(DebtSettlement(
            from_user_id=debtors[i]["user_id"],
            to_user_id=creditors[j]["user_id"],
            amount=round(amount, 2),
        ))
        debtors[i]["amount"] -= amount
        creditors[j]["amount"] -= amount
        if debtors[i]["amount"] < CENT:
            i += 1
        if creditors[j]["amount"] < CENT:
            j += 1

    return {
        "event_id": event_id,
        "total_event_cost": round(total_cost, 2),
        "settlements": settlements,
    }


def calculate_global_finance_summary(db: Session, user_id: int):
    event_ids = [
        p.event_id for p in db.query(EventParticipant.event_id).filter(
            EventParticipant.user_id == user_id
        ).all()
    ]

    total_to_pay = 0.0
    total_to_receive = 0.0
    for eid in event_ids:
        summary = calculate_finance_summary(db, eid)
        for s in summary["settlements"]:
            if s.from_user_id == user_id:
                total_to_pay += s.amount
            elif s.to_user_id == user_id:
                total_to_receive += s.amount

    return {
        "total_to_pay": round(total_to_pay, 2),
        "total_to_receive": round(total_to_receive, 2),
    }


# --- SPŁATY ---

def _ensure_participant(db: Session, event_id: int, user_id: int) -> None:
    if user_id not in _participant_ids(db, event_id):
        raise HTTPException(status_code=403, detail="Nie masz dostępu do tego wydarzenia.")


def settle_share(db: Session, event_id: int, share_id: int, user_id: int) -> Expense:
    """Oznacza pojedynczy udział jako spłacony i tworzy wpis audytowy w logu spłat."""
    _ensure_participant(db, event_id, user_id)

    share = db.query(ExpenseShare).filter(ExpenseShare.id == share_id).first()
    if not share:
        raise HTTPException(status_code=404, detail="Nie znaleziono udziału.")

    expense = db.query(Expense).filter(Expense.id == share.expense_id).first()
    if not expense or expense.event_id != event_id:
        raise HTTPException(status_code=404, detail="Udział nie należy do tego wydarzenia.")
    if _is_settlement(expense):
        raise HTTPException(status_code=400, detail="Nie można spłacać wpisu audytowego.")
    if share.user_id != user_id:
        raise HTTPException(status_code=403, detail="Możesz spłacić tylko własny dług.")
    if share.is_settled:
        raise HTTPException(status_code=400, detail="Ten udział jest już spłacony.")
    if expense.payer_id == user_id:
        raise HTTPException(status_code=400, detail="Nie spłacasz długu wobec samego siebie.")

    share.is_settled = True
    share.settled_at = datetime.now(timezone.utc)

    audit = Expense(
        event_id=event_id,
        payer_id=user_id,
        amount=round(share.amount, 2),
        description=f"{SETTLEMENT_PREFIX} #{share.id}: {expense.description or 'zakup'}",
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    db.add(ExpenseShare(
        expense_id=audit.id,
        user_id=expense.payer_id,
        amount=round(share.amount, 2),
        is_settled=True,
        settled_at=datetime.now(timezone.utc),
    ))
    db.commit()
    db.refresh(audit)
    return audit


def settle_all_with_creditor(db: Session, event_id: int, user_id: int, creditor_id: int) -> Expense | None:
    """Oznacza wszystkie niespłacone udziały zalogowanego usera wobec danego wierzyciela."""
    _ensure_participant(db, event_id, user_id)
    _ensure_participant(db, event_id, creditor_id)
    if user_id == creditor_id:
        raise HTTPException(status_code=400, detail="Nie spłacasz długu wobec samego siebie.")

    open_shares = (
        db.query(ExpenseShare)
        .join(Expense, ExpenseShare.expense_id == Expense.id)
        .filter(
            Expense.event_id == event_id,
            Expense.payer_id == creditor_id,
            ExpenseShare.user_id == user_id,
            ExpenseShare.is_settled.is_(False),
        )
        .all()
    )
    # Wykluczamy udziały należące do wpisów audytowych (na wypadek dziwnych danych).
    open_shares = [s for s in open_shares if not _is_settlement(s.expense)]

    if not open_shares:
        raise HTTPException(status_code=400, detail="Brak otwartych długów wobec tego użytkownika.")

    total = round(sum(s.amount for s in open_shares), 2)
    now = datetime.now(timezone.utc)
    for s in open_shares:
        s.is_settled = True
        s.settled_at = now

    audit = Expense(
        event_id=event_id,
        payer_id=user_id,
        amount=total,
        description=f"{SETTLEMENT_PREFIX} zbiorcze ({len(open_shares)} pozycji)",
    )
    db.add(audit)
    db.commit()
    db.refresh(audit)
    db.add(ExpenseShare(
        expense_id=audit.id,
        user_id=creditor_id,
        amount=total,
        is_settled=True,
        settled_at=now,
    ))
    db.commit()
    db.refresh(audit)
    return audit
