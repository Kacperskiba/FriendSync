import pytest
from pydantic import ValidationError

from app.schemas.user import UserCreate
from app.schemas.expense import ExpenseCreate, ExpenseShareCreate


class TestUserCreateSchema:
    def test_valid_user_passes_validation(self):
        user = UserCreate(username="alice", email="alice@example.com", password="securepass")
        assert user.username == "alice"
        assert user.email == "alice@example.com"

    def test_username_too_short_fails(self):
        with pytest.raises(ValidationError) as exc:
            UserCreate(username="ab", email="test@example.com", password="securepass")
        assert "username" in str(exc.value)

    def test_username_too_long_fails(self):
        with pytest.raises(ValidationError):
            UserCreate(username="a" * 51, email="test@example.com", password="securepass")

    def test_username_exactly_min_length_passes(self):
        user = UserCreate(username="abc", email="test@example.com", password="securepass")
        assert len(user.username) == 3

    def test_username_exactly_max_length_passes(self):
        user = UserCreate(username="a" * 50, email="test@example.com", password="securepass")
        assert len(user.username) == 50

    def test_invalid_email_fails(self):
        with pytest.raises(ValidationError):
            UserCreate(username="alice", email="not-an-email", password="securepass")

    def test_missing_at_sign_in_email_fails(self):
        with pytest.raises(ValidationError):
            UserCreate(username="alice", email="aliceexample.com", password="securepass")

    def test_password_too_short_fails(self):
        with pytest.raises(ValidationError):
            UserCreate(username="alice", email="alice@example.com", password="short")

    def test_password_exactly_8_chars_passes(self):
        user = UserCreate(username="alice", email="alice@example.com", password="12345678")
        assert len(user.password) == 8

    def test_all_fields_required(self):
        with pytest.raises(ValidationError):
            UserCreate(username="alice")


class TestExpenseSchemas:
    def test_valid_expense_passes(self):
        expense = ExpenseCreate(
            amount=90.0,
            description="Kolacja",
            shares=[
                ExpenseShareCreate(user_id=1, amount=30.0),
                ExpenseShareCreate(user_id=2, amount=30.0),
                ExpenseShareCreate(user_id=3, amount=30.0),
            ]
        )
        assert expense.amount == 90.0
        assert len(expense.shares) == 3

    def test_expense_zero_amount_fails(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(
                amount=0,
                shares=[ExpenseShareCreate(user_id=1, amount=1.0)]
            )

    def test_expense_negative_amount_fails(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(
                amount=-10.0,
                shares=[ExpenseShareCreate(user_id=1, amount=5.0)]
            )

    def test_expense_description_is_optional(self):
        expense = ExpenseCreate(
            amount=10.0,
            shares=[ExpenseShareCreate(user_id=1, amount=10.0)]
        )
        assert expense.description is None

    def test_expense_description_too_long_fails(self):
        with pytest.raises(ValidationError):
            ExpenseCreate(
                amount=10.0,
                description="x" * 256,
                shares=[ExpenseShareCreate(user_id=1, amount=10.0)]
            )

    def test_expense_description_max_255_chars_passes(self):
        expense = ExpenseCreate(
            amount=10.0,
            description="x" * 255,
            shares=[ExpenseShareCreate(user_id=1, amount=10.0)]
        )
        assert len(expense.description) == 255

    def test_share_zero_amount_fails(self):
        with pytest.raises(ValidationError):
            ExpenseShareCreate(user_id=1, amount=0.0)

    def test_share_negative_amount_fails(self):
        with pytest.raises(ValidationError):
            ExpenseShareCreate(user_id=1, amount=-5.0)

    def test_share_positive_amount_passes(self):
        share = ExpenseShareCreate(user_id=7, amount=25.50)
        assert share.user_id == 7
        assert share.amount == 25.50
