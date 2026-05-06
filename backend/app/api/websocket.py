from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

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
                    # Jeśli połączenie padło, zignoruj - zostanie usunięte przy rozłączeniu
                    pass

    async def connect_user(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

    def disconnect_user(self, websocket: WebSocket, user_id: int):
        if user_id in self.user_connections:
            self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]

    async def broadcast_to_user(self, user_id: int, message: str = "refresh"):
        """Wysyła sygnał bezpośrednio do konkretnego użytkownika"""
        if user_id in self.user_connections:
            for connection in self.user_connections[user_id]:
                try:
                    await connection.send_text(message)
                except:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/events/{event_id}")
async def websocket_endpoint(websocket: WebSocket, event_id: int):
    await manager.connect(websocket, event_id)
    try:
        while True:
            # Utrzymujemy połączenie otwarte
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, event_id)

@router.websocket("/ws/users/{user_id}")
async def user_websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect_user(websocket, user_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect_user(websocket, user_id)