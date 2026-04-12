from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.location import LocationCreate, LocationResponse, VoteCreate
from app.crud import location as location_crud

router = APIRouter(tags=["Locations"])

@router.get("/api/events/{event_id}/locations", response_model=List[LocationResponse])
def read_locations(event_id: int, db: Session = Depends(get_db)):
    """Zwraca listę lokalizacji z sumą głosów"""
    return location_crud.get_locations_with_votes(db, event_id)

@router.post("/api/events/{event_id}/locations", response_model=LocationResponse)
def add_location(
    event_id: int,
    location_in: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dodaje nową pinezkę na mapie (wymaga tokena JWT)"""
    return location_crud.create_location(db, location_in, event_id, current_user.id)

@router.post("/api/locations/{location_id}/votes")
def vote(
    location_id: int,
    vote_in: VoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Oddaje lub zmienia głos na lokalizację"""
    return location_crud.add_or_update_vote(db, location_id, current_user.id, vote_in.vote_value)

@router.delete("/api/locations/{location_id}/votes")
def remove_vote(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Usuwa głos zalogowanego użytkownika."""
    success = location_crud.delete_vote(db, location_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Głos nie został znaleziony")
    return {"message": "Głos został usunięty"}