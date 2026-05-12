import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.api import user_routes
from app.api import event_routes
from app.api import location_routes
from app.models import user, event, expense, location, message, friendship, notification
from app.api import friend_routes
from app.api import notification_routes
from fastapi.staticfiles import StaticFiles
from app.api import websocket
from app.models.sub_event import SubEvent
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FriendSync API",
    description="API dla aplikacji do planowania spotkań i rozliczeń ze znajomymi",
    version="1.0.0"
)

# --- KLUCZOWY ELEMENT DLA ZDJĘĆ ---
# Sprawdzamy czy folder istnieje, żeby serwer się nie wywalił przy starcie
if not os.path.exists("static"):
    os.makedirs("static/avatars", exist_ok=True)

# Montujemy folder 'static' pod ścieżkę '/static'
# Dzięki temu plik w static/avatars/user1.jpg będzie dostępny w przeglądarce
app.mount("/static", StaticFiles(directory="static"), name="static")
# ----------------------------------

# Konfiguracja CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://friend-synnc.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
