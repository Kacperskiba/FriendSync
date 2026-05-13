from app.models.friendship import Friendship
from app.models.user import User
from app.models.event import EventParticipant
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List, Any

import jwt
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.core.database import get_db, SessionLocal
from app.core.config import settings

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.user_connections: Dict[int, List[WebSocket]] = {}

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

    async def send_to_user(self, user_id: int, message: Dict[str, Any]):
        """Wysyła JSON do wszystkich połączeń konkretnego użytkownika."""
        if user_id not in self.user_connections:
            return
        dead_sockets = []
        for connection in self.user_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception:
                dead_sockets.append(connection)
        for dead in dead_sockets:
            if dead in self.user_connections.get(user_id, []):
                self.user_connections[user_id].remove(dead)
        if user_id in self.user_connections and not self.user_connections[user_id]:
            del self.user_connections[user_id]

    async def broadcast_to_users(self, user_ids: List[int], message: Dict[str, Any]):
        for uid in user_ids:
            await self.send_to_user(uid, message)

    async def broadcast_to_event(self, event_id: int, message: Dict[str, Any], db: Session):
        """Wysyła wiadomość do wszystkich uczestników danego eventu."""
        participants = db.query(EventParticipant.user_id).filter(
            EventParticipant.event_id == event_id
        ).all()
        user_ids = [p.user_id for p in participants]
        await self.broadcast_to_users(user_ids, message)

    def is_user_online(self, user_id: int) -> bool:
        return user_id in self.user_connections and len(self.user_connections[user_id]) > 0

    async def notify_friends_status_change(self, user_id: int, is_online: bool, db: Session):
        """Informuje znajomych o zmianie statusu online."""
        friends = db.query(Friendship).filter(
            ((Friendship.user_id == user_id) | (Friendship.friend_id == user_id)),
            (Friendship.status == "accepted")
        ).all()

        friend_ids = [f.friend_id if f.user_id == user_id else f.user_id for f in friends]
        message = {"type": "user_status", "user_id": user_id, "is_online": is_online}
        await self.broadcast_to_users(friend_ids, message)


manager = ConnectionManager()


def _user_id_from_token(token: str) -> int | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub = payload.get("sub")
        return int(sub) if sub is not None else None
    except (jwt.PyJWTError, ValueError, TypeError):
        return None


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str | None = None):
    user_id = _user_id_from_token(token) if token else None
    if user_id is None:
        await websocket.close(code=1008)
        return

    await manager.connect_user(websocket, user_id)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if user:
            user.last_active = datetime.now()
            db.commit()
            await manager.notify_friends_status_change(user_id, True, db)
    finally:
        db.close()

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        is_last = manager.disconnect_user(websocket, user_id)
        if is_last:
            db = SessionLocal()
            try:
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    user.last_active = datetime.now() - timedelta(seconds=5)
                    db.commit()
                    await manager.notify_friends_status_change(user_id, False, db)
            finally:
                db.close()


@router.get("/api/users/{user_id}/online-status")
async def get_user_online_status(user_id: int):
    return {"user_id": user_id, "is_online": manager.is_user_online(user_id)}
