from app.models.friendship import Friendship
from app.models.user import User
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List

from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core.database import get_db

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.user_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, event_id: int):
        await websocket.accept()
        if event_id not in self.active_connections:
            self.active_connections[event_id] = []
        self.active_connections[event_id].append(websocket)

    def disconnect(self, websocket: WebSocket, event_id: int):
        if event_id in self.active_connections:
            self.active_connections[event_id].remove(websocket)
            if not self.active_connections[event_id]:
                del self.active_connections[event_id]

    async def broadcast(self, event_id: int):
        """Wysyła pusty sygnał do wszystkich w danym evencie, by odświeżyli dane"""
        if event_id in self.active_connections:
            for connection in self.active_connections[event_id]:
                try:
                    await connection.send_text("refresh")
                except:
                    pass

    async def connect_user(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

    def disconnect_user(self, websocket: WebSocket, user_id: int) -> bool:
        """Usuwa websocket z listy. Zwraca True gdy to było ostatnie połączenie usera."""
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
                return True
        return False

    async def broadcast_to_user(self, user_id: int, message: str = "refresh"):
        """Wysyła sygnał bezpośrednio do konkretnego użytkownika"""
        if user_id in self.user_connections:
            dead_sockets = []
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_text(message)
                except:
                    dead_sockets.append(connection)
            # Czyść martwe sockety przy okazji wysyłania
            for dead in dead_sockets:
                if dead in self.user_connections.get(user_id, []):
                    self.user_connections[user_id].remove(dead)
            # Jeśli po czyszczeniu lista jest pusta, usuń klucz
            if user_id in self.user_connections and not self.user_connections[user_id]:
                del self.user_connections[user_id]

    def is_user_online(self, user_id: int) -> bool:
        """Sprawdza czy użytkownik ma aktywne połączenie WS"""
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

    async def notify_friends_status_change(self, user_id: int, status: str, db: Session):
        """Informuje wszystkich zalogowanych znajomych o zmianie statusu"""
        friends = db.query(Friendship).filter(
            ((Friendship.user_id == user_id) | (Friendship.friend_id == user_id)),
            (Friendship.status == "accepted")
        ).all()

        friend_ids = [f.friend_id if f.user_id == user_id else f.user_id for f in friends]

        message = f"status_update:{user_id}:{status}"
        for f_id in friend_ids:
            if f_id in self.user_connections:
                await self.broadcast_to_user(f_id, message)


manager = ConnectionManager()


@router.websocket("/ws/events/{event_id}")
async def websocket_endpoint(websocket: WebSocket, event_id: int):
    await manager.connect(websocket, event_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, event_id)


@router.websocket("/ws/users/{user_id}")
async def user_websocket_endpoint(websocket: WebSocket, user_id: int):
    db_gen = get_db()
    db = next(db_gen)

    try:
        await manager.connect_user(websocket, user_id)

        # Użytkownik wszedł → ONLINE
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.last_active = datetime.now()
            db.commit()
            # NAPRAWA: Powiadom znajomych że jesteś online dopiero po zapisie do bazy
            await manager.notify_friends_status_change(user_id, "online", db)

        try:
            while True:
                await websocket.receive_text()
        except WebSocketDisconnect:
            is_last = manager.disconnect_user(websocket, user_id)

            if is_last:
                # Pobierz usera świeżo z bazy po rozłączeniu
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.last_active = datetime.now() - timedelta(seconds=5)
                    db.commit()
                    await manager.notify_friends_status_change(user_id, "offline", db)
    finally:
        db.close()


@router.get("/api/users/{user_id}/online-status")
async def get_user_online_status(user_id: int):
    """Zwraca aktualny status online użytkownika na podstawie aktywnych połączeń WS"""
    return {"user_id": user_id, "is_online": manager.is_user_online(user_id)}