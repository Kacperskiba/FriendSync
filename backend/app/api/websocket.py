from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, List

router = APIRouter()

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

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