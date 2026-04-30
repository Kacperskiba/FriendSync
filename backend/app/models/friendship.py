from sqlalchemy import Column, Integer, String, ForeignKey
from app.core.database import Base

class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))      # Osoba, która wysyła zaproszenie
    friend_id = Column(Integer, ForeignKey("users.id"))    # Osoba, która otrzymuje zaproszenie
    status = Column(String, default="pending")             # 'pending' (oczekujące) lub 'accepted' (zaakceptowane)