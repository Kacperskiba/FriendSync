from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from pydantic import ConfigDict

class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50, description="Nazwa użytkownika")
    email: EmailStr = Field(..., description="Poprawny adres e-mail")

class UserCreate(UserBase):
    password: str = Field(..., min_length=8, description="Hasło musi mieć minimum 8 znaków")

class UserResponse(UserBase):
    id: int
    created_at: datetime
    profile_image: str | None = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str