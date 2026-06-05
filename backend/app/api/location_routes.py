from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.location import LocationCreate, LocationResponse, VoteCreate
from app.crud import location as location_crud
from app.crud.event import get_participant
from app.models.location import LocationProposal

from app.api.websocket import manager

router = APIRouter(tags=["Locations"])

@router.get("/api/events/{event_id}/locations", response_model=List[LocationResponse])
def read_locations(event_id: int, db: Session = Depends(get_db)):
    """Zwraca listę lokalizacji z sumą głosów"""
    return location_crud.get_locations_with_votes(db, event_id)

# --- DODAWANIE LOKALIZACJI ---
@router.post("/api/events/{event_id}/locations", response_model=LocationResponse)
async def add_location(
    event_id: int,
    location_in: LocationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dodaje nową pinezkę na mapie (wymaga tokena JWT)"""
    new_location = location_crud.create_location(db, location_in, event_id, current_user.id)

    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return new_location


# --- USUWANIE LOKALIZACJI ---
@router.delete("/api/locations/{location_id}")
async def delete_location(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Usuwa punkt z mapy. Dozwolone dla uczestników wydarzenia.
    Powiązane głosy znikają kaskadowo, a podpunkty tracą powiązanie (SET NULL)."""
    location = db.query(LocationProposal).filter(LocationProposal.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Punkt nie istnieje.")

    if not get_participant(db, event_id=location.event_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Brak dostępu do tego wydarzenia.")

    event_id = location.event_id
    db.delete(location)
    db.commit()

    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return {"message": "Punkt usunięty"}


# --- GŁOSOWANIE NA LOKALIZACJĘ ---
@router.post("/api/locations/{location_id}/votes")
async def  vote(
    location_id: int,
    vote_in: VoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Oddaje lub zmienia głos na lokalizację"""
    result = location_crud.add_or_update_vote(db, location_id, current_user.id, vote_in.vote_value)

    location = db.query(LocationProposal).filter(LocationProposal.id == location_id).first()
    if location:
        await manager.broadcast_to_event(location.event_id, {"type": "event_updated", "event_id": location.event_id}, db)
    return result

# --- USUWANIE GŁOSU ---
@router.delete("/api/locations/{location_id}/votes")
async def remove_vote(
    location_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Usuwa głos zalogowanego użytkownika."""
    location = db.query(LocationProposal).filter(LocationProposal.id == location_id).first()

    success = location_crud.delete_vote(db, location_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Głos nie został znaleziony")

    if location:
        await manager.broadcast_to_event(location.event_id, {"type": "event_updated", "event_id": location.event_id}, db)
    return {"message": "Głos został usunięty"}