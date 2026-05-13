from typing import Optional

from pydantic import BaseModel, ConfigDict

class FriendRequestCreate(BaseModel):
    friend_identifier: str


class FriendUserResponse(BaseModel):
    id: int
    username: str
    email: str
    profile_image: Optional[str] = None
    # --- DODAJ TE LINIE PONIŻEJ ---
    bio: Optional[str] = None
    tags: Optional[str] = None
    is_online: bool = False  # To pozwoli przesyłać status kropki
    # ------------------------------

    model_config = ConfigDict(from_attributes=True)
class PendingRequestResponse(BaseModel):
    friendship_id: int
    user: FriendUserResponse