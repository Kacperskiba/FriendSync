from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session
from datetime import timedelta

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.core.config import settings
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token
from app.crud.user import get_user_by_email, get_user_by_username, create_user
from pydantic import EmailStr
import shutil
import os
from fastapi import UploadFile, File, Form
from app.api.websocket import manager
from app.models.friendship import Friendship
from app.crud.expense import calculate_global_finance_summary
from app.schemas.expense import GlobalFinanceSummaryResponse

router = APIRouter(
    prefix="/api/users",
    tags=["Users"]
)


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(
        email: EmailStr = Form(...),
        username: str = Form(...),
        password: str = Form(...),
        profile_image: UploadFile = File(None),
        db: Session = Depends(get_db)
):
    if get_user_by_email(db, email):
        raise HTTPException(status_code=400, detail="Email zajęty")
    if get_user_by_username(db, username):
        raise HTTPException(status_code=400, detail="Nazwa użytkownika zajęta")

    file_path = None
    if profile_image:
        os.makedirs("static/avatars", exist_ok=True)
        file_path = f"static/avatars/{username}_{profile_image.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(profile_image.file, buffer)

    hashed_password = get_password_hash(password)
    new_user = User(
        username=username,
        email=email,
        password_hash=hashed_password,
        profile_image=file_path
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
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
def read_users_me(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    # USUNIĘTO: current_user.last_active = func.now()
    # To resetowało zegar przy każdym wywołaniu i blokowało przejście w offline.
    # Status online jest teraz wyłącznie określany przez WebSocket.
    return current_user


@router.patch("/me", response_model=UserResponse)
async def update_user_profile(
        username: Optional[str] = Form(None),
        email: Optional[EmailStr] = Form(None),
        confirm_email: Optional[EmailStr] = Form(None),
        password: Optional[str] = Form(None),
        confirm_password: Optional[str] = Form(None),
        profile_image: Optional[UploadFile] = File(None),
        bio: Optional[str] = Form(None),
        tags: Optional[str] = Form(None),
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    if email:
        if email != confirm_email:
            raise HTTPException(status_code=400, detail="Podane adresy email nie są identyczne")
        if email != current_user.email:
            if get_user_by_email(db, email):
                raise HTTPException(status_code=400, detail="Ten email jest już zajęty")
            current_user.email = email

    if password:
        if password != confirm_password:
            raise HTTPException(status_code=400, detail="Hasła nie są identyczne")
        current_user.password_hash = get_password_hash(password)

    if username and username != current_user.username:
        if get_user_by_username(db, username):
            raise HTTPException(status_code=400, detail="Nazwa użytkownika zajęta")
        current_user.username = username

    if profile_image:
        os.makedirs("static/avatars", exist_ok=True)
        file_path = f"static/avatars/{current_user.id}_{profile_image.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(profile_image.file, buffer)
        current_user.profile_image = file_path

    if bio is not None:
        current_user.bio = bio
    if tags is not None:
        current_user.tags = tags

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    # Powiadom znajomych że profil się zmienił (avatar, bio, nick, tagi)
    friendships = db.query(Friendship).filter(
        ((Friendship.user_id == current_user.id) | (Friendship.friend_id == current_user.id)),
        Friendship.status == "accepted"
    ).all()
    friend_ids = [f.friend_id if f.user_id == current_user.id else f.user_id for f in friendships]
    await manager.broadcast_to_users(
        friend_ids,
        {"type": "profile_updated", "user_id": current_user.id}
    )

    return current_user


@router.get("/me/finances/summary", response_model=GlobalFinanceSummaryResponse)
def read_global_finance_summary(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Sumuje długi i należności użytkownika ze wszystkich eventów."""
    return calculate_global_finance_summary(db, current_user.id)


@router.delete("/me", status_code=status.HTTP_200_OK)
async def delete_my_account(
        db: Session = Depends(get_db),
        current_user: User = Depends(get_current_user)
):
    """Trwale usuwa konto użytkownika i wszystkie związane z nim dane."""
    from app.models.expense import Expense, ExpenseShare
    from app.models.message import Message
    from app.models.location import LocationProposal, LocationVote
    from app.models.event import Event, EventParticipant
    from app.models.event_invitation import EventInvitation
    from app.models.notification import Notification

    user_id = current_user.id

    # Powiadom znajomych że profil znika (żeby zniknął z ich list)
    friendships_for_notify = db.query(Friendship).filter(
        ((Friendship.user_id == user_id) | (Friendship.friend_id == user_id)),
        Friendship.status == "accepted"
    ).all()
    friend_ids = [f.friend_id if f.user_id == user_id else f.user_id for f in friendships_for_notify]

    # 1. Czyszczenie głosów i propozycji lokalizacji
    db.query(LocationVote).filter(LocationVote.user_id == user_id).delete()
    loc_ids = [l.id for l in db.query(LocationProposal.id).filter(LocationProposal.creator_id == user_id).all()]
    if loc_ids:
        db.query(LocationVote).filter(LocationVote.location_id.in_(loc_ids)).delete(synchronize_session=False)
        db.query(LocationProposal).filter(LocationProposal.id.in_(loc_ids)).delete(synchronize_session=False)

    # 2. Wiadomości
    db.query(Message).filter(Message.author_id == user_id).delete()

    # 3. Wydatki
    db.query(ExpenseShare).filter(ExpenseShare.user_id == user_id).delete()
    exp_ids = [e.id for e in db.query(Expense.id).filter(Expense.payer_id == user_id).all()]
    if exp_ids:
        db.query(ExpenseShare).filter(ExpenseShare.expense_id.in_(exp_ids)).delete(synchronize_session=False)
        db.query(Expense).filter(Expense.id.in_(exp_ids)).delete(synchronize_session=False)

    # 4. Zaproszenia i znajomości
    db.query(EventInvitation).filter(
        (EventInvitation.user_id == user_id) | (EventInvitation.inviter_id == user_id)
    ).delete(synchronize_session=False)
    db.query(Friendship).filter(
        (Friendship.user_id == user_id) | (Friendship.friend_id == user_id)
    ).delete(synchronize_session=False)
    db.query(Notification).filter(Notification.user_id == user_id).delete()

    # 5. Uczestnictwo w eventach
    db.query(EventParticipant).filter(EventParticipant.user_id == user_id).delete()

    # 6. Eventy które user stworzył: przekaż innym uczestnikom lub usuń
    my_events = db.query(Event).filter(Event.creator_id == user_id).all()
    for ev in my_events:
        next_participant = db.query(EventParticipant).filter(EventParticipant.event_id == ev.id).first()
        if next_participant:
            ev.creator_id = next_participant.user_id
        else:
            db.delete(ev)

    db.commit()

    # 7. Usuń usera
    db.delete(current_user)
    db.commit()

    # 8. Powiadom znajomych żeby ich frontend odświeżył listę
    for fid in friend_ids:
        await manager.send_to_user(fid, {"type": "friend_removed", "user_id": user_id})

    return {"message": "Konto zostało trwale usunięte."}