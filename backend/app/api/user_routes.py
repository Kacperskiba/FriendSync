from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token
from app.crud.user import get_user_by_email, get_user_by_username, create_user
router = APIRouter(
    prefix="/api/users",
    tags=["Users"]
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user: UserCreate, db: Session = Depends(get_db)):

    db_user_email = get_user_by_email(db, email=user.email)
    if db_user_email:
        raise HTTPException(status_code=400, detail="Ten adres email jest już zarejestrowany.")

    db_user_username = get_user_by_username(db, username=user.username)
    if db_user_username:
        raise HTTPException(status_code=400, detail="Ta nazwa użytkownika jest już zajęta.")

    new_user = create_user(db=db, user=user)

    return new_user


@router.post("/login", response_model=Token)
def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):


    user = get_user_by_email(db, email=form_data.username) or get_user_by_username(db, username=form_data.username)

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nieprawidłowy email/login lub hasło",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):

    return current_user