from pydantic import BaseModel, ConfigDict

class FriendRequestCreate(BaseModel):
    friend_email: str

class FriendUserResponse(BaseModel):
    id: int
    username: str
    email: str
    model_config = ConfigDict(from_attributes=True)

class PendingRequestResponse(BaseModel):
    friendship_id: int
    user: FriendUserResponse