import secrets
import warnings

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "FriendSync API"

    # Tryb pracy: "development" lub "production".
    # W produkcji wymuszamy ustawione, silne SECRET_KEY (>=32 znaki) — inaczej app się nie wystartuje.
    ENVIRONMENT: str = "production"

    ALGORITHM: str = "HS256"
    # Krótki access token zmniejsza skutki kradzieży tokena.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # Pusty domyślny — w dev wygenerujemy losowy klucz przy starcie,
    # w produkcji brak klucza = błąd.
    SECRET_KEY: str = "76345763473457345345"

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/friendsync"

    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Limit rozmiaru avatara w bajtach (5 MB).
    MAX_AVATAR_SIZE: int = 5 * 1024 * 1024

    # Publiczny adres frontendu — używany do budowania linków w e-mailach.
    FRONTEND_URL: str = "http://localhost:5173"

    # SMTP do wysyłki e-maili (reset hasła). Pusty SMTP_HOST = tryb dev:
    # zamiast wysyłki link resetujący jest logowany na stdout backendu.
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()


def _validate_secret_key() -> None:
    is_prod = settings.ENVIRONMENT.lower() == "production"
    weak_defaults = {"", "12345", "changeme", "secret", "password"}

    if not settings.SECRET_KEY or settings.SECRET_KEY in weak_defaults or len(settings.SECRET_KEY) < 32:
        if is_prod:
            raise RuntimeError(
                "SECRET_KEY jest nieustawiony lub zbyt słaby. "
                "W produkcji wymagany jest losowy klucz o długości >= 32 znaków "
                "(np. wygenerowany przez `python -c \"import secrets; print(secrets.token_urlsafe(64))\"`)."
            )
        # W dev generujemy efemeryczny klucz — wymusi to ponowne logowanie po każdym restarcie,
        # ale eliminuje ryzyko, że dev-klucz przejdzie do produkcji.
        settings.SECRET_KEY = secrets.token_urlsafe(64)
        warnings.warn(
            "Używam losowo wygenerowanego SECRET_KEY (development). "
            "Ustaw SECRET_KEY w .env, aby tokeny przetrwały restart.",
            stacklevel=2,
        )


_validate_secret_key()
