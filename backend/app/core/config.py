from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Nazwa projektu
    PROJECT_NAME: str = "FriendSync API"

    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7

    SECRET_KEY: str = "12345"

    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/friendsync"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()