from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import jwt
from pydantic import ValidationError

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.crud.user import get_user

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/users/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Nie udało się zweryfikować uprawnień (Błędny lub nieważny token)",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:

        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])

        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception

    except (jwt.PyJWTError, ValidationError):
        raise credentials_exception

    user = get_user(db, user_id=int(user_id))
    if user is None:
        raise credentials_exception

    return user