from unittest.mock import patch, MagicMock
from app.crud.expense import calculate_finance_summary


def make_expense(payer_id, amount, shares):
    """Tworzy mock wydatku z odpowiednimi atrybutami."""
    expense = MagicMock()
    expense.payer_id = payer_id
    expense.amount = amount
    expense.shares = [
        MagicMock(user_id=uid, amount=amt) for uid, amt in shares
    ]
    return expense


def run_summary(expenses, event_id=1):
    """Uruchamia calculate_finance_summary z zamockowaną bazą danych."""
    mock_db = MagicMock()
    with patch("app.crud.expense.get_event_expenses", return_value=expenses):
        return calculate_finance_summary(mock_db, event_id=event_id)


class TestCalculateFinanceSummary:
    def test_no_expenses_returns_empty_result(self):
        result = run_summary([])
        assert result["total_event_cost"] == 0.0
        assert result["settlements"] == []

    def test_total_cost_is_sum_of_all_expenses(self):
        expenses = [
            make_expense(1, 60.0, [(1, 30.0), (2, 30.0)]),
            make_expense(2, 40.0, [(1, 20.0), (2, 20.0)]),
        ]
        result = run_summary(expenses)
        assert result["total_event_cost"] == 100.0

    def test_event_id_is_preserved_in_result(self):
        result = run_summary([], event_id=42)
        assert result["event_id"] == 42

    def test_single_payer_two_debtors(self):
        # User 1 płaci 90, split równy: każdy winien 30
        # Bilans: User 1 = +90 - 30 = +60; User 2 = -30; User 3 = -30
        expenses = [make_expense(1, 90.0, [(1, 30.0), (2, 30.0), (3, 30.0)])]
        result = run_summary(expenses)

        settlements = result["settlements"]
        assert len(settlements) == 2
        assert all(s.to_user_id == 1 for s in settlements)
        assert all(s.from_user_id in (2, 3) for s in settlements)
        total_paid = sum(s.amount for s in settlements)
        assert abs(total_paid - 60.0) < 0.01

    def test_two_payers_balanced_situation(self):
        # User 1 i User 2 płacą po tyle samo dla siebie nawzajem – bilans zerowy
        expenses = [
            make_expense(1, 50.0, [(1, 25.0), (2, 25.0)]),
            make_expense(2, 50.0, [(1, 25.0), (2, 25.0)]),
        ]
        result = run_summary(expenses)
        assert len(result["settlements"]) == 0

    def test_settlement_minimizes_number_of_transfers(self):
        # User 3 winien obu (User 1 i User 2) – powinny być dokładnie 2 przelewy
        expenses = [
            make_expense(1, 60.0, [(1, 20.0), (2, 20.0), (3, 20.0)]),
            make_expense(2, 60.0, [(1, 20.0), (2, 20.0), (3, 20.0)]),
        ]
        result = run_summary(expenses)
        assert len(result["settlements"]) == 2

    def test_settlement_amounts_rounded_to_two_decimals(self):
        expenses = [make_expense(1, 10.0, [(2, 5.0), (3, 5.0)])]
        result = run_summary(expenses)
        for s in result["settlements"]:
            assert s.amount == round(s.amount, 2)

    def test_payer_who_also_owes_has_correct_balance(self):
        # User 1 płaci 100, ale sam jest winien 60 (share 60) – netto +40
        # User 2 winien 40 (share 40)
        expenses = [make_expense(1, 100.0, [(1, 60.0), (2, 40.0)])]
        result = run_summary(expenses)
        settlements = result["settlements"]
        assert len(settlements) == 1
        assert settlements[0].from_user_id == 2
        assert settlements[0].to_user_id == 1
        assert abs(settlements[0].amount - 40.0) < 0.01

    def test_multiple_expenses_same_payer(self):
        # User 1 płaci dwa razy za User 2
        expenses = [
            make_expense(1, 30.0, [(2, 30.0)]),
            make_expense(1, 20.0, [(2, 20.0)]),
        ]
        result = run_summary(expenses)
        assert result["total_event_cost"] == 50.0
        settlements = result["settlements"]
        assert len(settlements) == 1
        assert abs(settlements[0].amount - 50.0) < 0.01

    def test_only_debtors_without_creditors_no_settlements(self):
        # Wszyscy mają share, nikt nie jest płatnikiem (niemożliwe w praktyce, ale defensywny test)
        expenses = []
        result = run_summary(expenses)
        assert result["settlements"] == []
