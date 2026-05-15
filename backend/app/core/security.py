import re
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import HTTPException, status
from passlib.context import CryptContext

from app.core.config import settings


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Stały dummy-hash używany przy logowaniu, gdy użytkownik nie istnieje — wyrównuje czas
# odpowiedzi i zapobiega user enumeration przez timing attack.
_DUMMY_HASH = pwd_context.hash(secrets.token_urlsafe(32))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Sprawdza, czy podane w logowaniu hasło pasuje do hasha w bazie."""
    return pwd_context.verify(plain_password, hashed_password)


def dummy_verify() -> None:
    """Wykonuje pełen koszt bcrypt dla nieistniejącego usera (timing-safe login)."""
    pwd_context.verify(secrets.token_urlsafe(16), _DUMMY_HASH)


def get_password_hash(password: str) -> str:
    """Zamienia zwykłe hasło na hash bcrypt."""
    return pwd_context.hash(password)


# Minimalna polityka haseł — wymusza długość + 3 z 4 klas znaków.
MIN_PASSWORD_LENGTH = 10
MAX_PASSWORD_LENGTH = 128

_COMMON_PASSWORDS = {
    "password", "password1", "qwerty", "qwerty123", "123456", "12345678",
    "123456789", "1234567890", "admin", "letmein", "welcome", "iloveyou",
    "abc123", "password123", "haslo", "haslo123", "zaq12wsx",
}


def validate_password_strength(password: str) -> None:
    """Rzuca HTTPException 400 jeśli hasło nie spełnia minimum bezpieczeństwa.

    Reguły: 10-128 znaków, co najmniej 3 z 4 klas (mała, duża, cyfra, znak specjalny),
    nie na liście pospolitych haseł.
    """
    if not isinstance(password, str):
        raise HTTPException(status_code=400, detail="Nieprawidłowe hasło.")

    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Hasło musi mieć co najmniej {MIN_PASSWORD_LENGTH} znaków.",
        )
    if len(password) > MAX_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Hasło może mieć maksymalnie {MAX_PASSWORD_LENGTH} znaków.",
        )

    if password.lower() in _COMMON_PASSWORDS:
        raise HTTPException(
            status_code=400,
            detail="Hasło jest zbyt popularne — wybierz mniej oczywiste.",
        )

    classes = 0
    if re.search(r"[a-z]", password):
        classes += 1
    if re.search(r"[A-Z]", password):
        classes += 1
    if re.search(r"\d", password):
        classes += 1
    if re.search(r"[^A-Za-z0-9]", password):
        classes += 1

    if classes < 3:
        raise HTTPException(
            status_code=400,
            detail="Hasło musi zawierać co najmniej 3 z 4: małą literę, dużą literę, cyfrę, znak specjalny.",
        )


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
    # iat + jti pozwalają w przyszłości na unieważnianie tokenów (denylist).
    to_encode.update({
        "exp": expire,
        "iat": datetime.now(timezone.utc),
        "jti": secrets.token_urlsafe(16),
        "type": "access",
    })
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
