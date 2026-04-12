from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.location import LocationCreate, LocationResponse
from app.crud import location as location_crud

router = APIRouter(tags=["Locations"])

@router.post("/api/events/{event_id}/locations", response_model=LocationResponse)
def add_location_proposal(
    event_id: int,
    location_in: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dodaje nową pinezkę na mapie wydarzenia"""
    return location_crud.create_location(db, location_in, event_id, current_user.id)

@router.get("/api/events/{event_id}/locations", response_model=List[LocationResponse])
def get_event_locations(event_id: int, db: Session = Depends(get_db)):
    """Zwraca listę wszystkich propozycji dla wydarzenia z sumą głosów"""
    return location_crud.get_locations_with_votes(db, event_id)

@router.post("/api/locations/{location_id}/votes")
def vote_for_location(
    location_id: int,
    vote_value: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Pozwala na oddanie głosu (np. 1 dla upvote)"""
    return location_crud.add_or_update_vote(db, location_id, current_user.id, vote_value)