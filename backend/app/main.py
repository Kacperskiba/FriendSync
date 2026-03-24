from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import engine, Base
from app.models import user
from app.api import user_routes


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="FriendSync API",
    description="API dla aplikacji do planowania spotkań i rozliczeń ze znajomymi",
    version="1.0.0"
)

# Konfiguracja CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(user_routes.router)

@app.get("/")
async def root():
    return {"message": "Witaj w FriendSync API! Serwer działa poprawnie."}

@app.get("/api/ping")
async def ping():
    return {"status": "ok", "service": "FriendSync"}