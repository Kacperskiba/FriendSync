import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware

from sqlalchemy import text

from app.core.database import engine, Base
from app.api import user_routes
from app.api import event_routes
from app.api import location_routes
from app.models import user, event, expense, location, message, friendship, notification, event_invitation
from app.api import friend_routes
from app.api import notification_routes
from fastapi.staticfiles import StaticFiles
from app.api import websocket
from app.models.sub_event import SubEvent
from app.core.config import settings
Base.metadata.create_all(bind=engine)


def _run_lightweight_migrations() -> None:
    """Idempotentne migracje wykonywane przy starcie (bez Alembica).

    Używamy `ADD COLUMN IF NOT EXISTS` (Postgres 9.6+), więc te ALTERy są
    bezpieczne do uruchamiania wielokrotnie i nie ruszają istniejących danych.
    """
    statements = [
        "ALTER TABLE expense_shares ADD COLUMN IF NOT EXISTS is_settled BOOLEAN NOT NULL DEFAULT FALSE",
        "ALTER TABLE expense_shares ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE NULL",
    ]
    with engine.begin() as conn:
        for stmt in statements:
            conn.execute(text(stmt))


_run_lightweight_migrations()

app = FastAPI(
    title="FriendSync API",
    description="API dla aplikacji do planowania spotkań i rozliczeń ze znajomymi",
    version="1.0.0",
    redirect_slashes=False
)

# --- KLUCZOWY ELEMENT DLA ZDJĘĆ ---
# Sprawdzamy czy folder istnieje, żeby serwer się nie wywalił przy starcie
if not os.path.exists("static"):
    os.makedirs("static/avatars", exist_ok=True)

# Montujemy folder 'static' pod ścieżkę '/static'
# Dzięki temu plik w static/avatars/user1.jpg będzie dostępny w przeglądarce
app.mount("/static", StaticFiles(directory="static"), name="static")
# ----------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(self), microphone=(), camera=()"
        # HSTS tylko gdy aplikacja chodzi za HTTPS w produkcji.
        if settings.ENVIRONMENT.lower() == "production":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


app.add_middleware(SecurityHeadersMiddleware)

# CORS — restrykcyjna allowlista origins, ograniczone metody i nagłówki.
origins = [o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)
app.include_router(user_routes.router)
app.include_router(event_routes.router)
app.include_router(location_routes.router)
app.include_router(friend_routes.router)
app.include_router(notification_routes.router)
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {"message": "Witaj w FriendSync API! Serwer działa poprawnie."}


@app.get("/api/ping")
async def ping():
    return {"status": "ok", "service": "FriendSync"}
