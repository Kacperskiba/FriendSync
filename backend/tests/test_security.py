from datetime import timedelta, datetime, timezone
import jwt
import pytest

from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.config import settings


class TestPasswordHashing:
    def test_hash_differs_from_plaintext(self):
        hashed = get_password_hash("supersecret123")
        assert hashed != "supersecret123"

    def test_bcrypt_generates_unique_salts(self):
        # Dwa hashe tego samego hasła muszą być różne (różne sole)
        h1 = get_password_hash("testhash")
        h2 = get_password_hash("testhash")
        assert h1 != h2

    def test_verify_correct_password_returns_true(self):
        hashed = get_password_hash("mypassword456")
        assert verify_password("mypassword456", hashed) is True

    def test_verify_wrong_password_returns_false(self):
        hashed = get_password_hash("correctpassword")
        assert verify_password("wrongpassword", hashed) is False

    def test_verify_empty_string_against_hash_returns_false(self):
        hashed = get_password_hash("somepassword")
        assert verify_password("", hashed) is False

    def test_hash_starts_with_bcrypt_prefix(self):
        hashed = get_password_hash("anypassword")
        assert hashed.startswith("$2b$") or hashed.startswith("$2a$")


class TestJWTTokens:
    def test_token_has_three_segments(self):
        token = create_access_token(data={"sub": "42"})
        assert len(token.split(".")) == 3

    def test_token_contains_correct_subject(self):
        token = create_access_token(data={"sub": "99"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["sub"] == "99"

    def test_token_contains_expiry_field(self):
        token = create_access_token(data={"sub": "1"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert "exp" in payload

    def test_custom_expiry_is_respected(self):
        delta = timedelta(hours=2)
        before = datetime.now(timezone.utc)
        token = create_access_token(data={"sub": "1"}, expires_delta=delta)
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        # Czas wygaśnięcia powinien być ~2h od teraz
        assert exp > before + timedelta(hours=1, minutes=50)
        assert exp <= before + delta + timedelta(seconds=5)

    def test_default_expiry_is_not_immediate(self):
        token = create_access_token(data={"sub": "1"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp > datetime.now(timezone.utc)

    def test_token_invalid_with_wrong_secret(self):
        token = create_access_token(data={"sub": "1"})
        with pytest.raises(jwt.InvalidSignatureError):
            jwt.decode(token, "wrong-secret", algorithms=[settings.ALGORITHM])

    def test_extra_fields_preserved_in_token(self):
        token = create_access_token(data={"sub": "1", "role": "admin"})
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert payload["role"] == "admin"

    def test_expired_token_raises_error(self):
        token = create_access_token(data={"sub": "1"}, expires_delta=timedelta(seconds=-1))
        with pytest.raises(jwt.ExpiredSignatureError):
            jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
