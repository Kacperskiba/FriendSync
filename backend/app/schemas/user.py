from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from pydantic import ConfigDict


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr = Field(...)


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)


class UserResponse(UserBase):
    id: int
    created_at: datetime
    profile_image: str | None = None
    bio: str | None = None
    tags: str | None = None
    last_active: datetime
    # NAPRAWA: default False zamiast wymaganego pola –
    # is_online nie istnieje już jako property na modelu,
    # wartość jest ustawiana przez serialize_friend() w friends.py
    is_online: bool = False

    model_config = ConfigDict(from_attributes=True)


class Token(BaseModel):
    access_token: str
    token_type: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=16, max_length=128)
    new_password: str = Field(..., min_length=8)