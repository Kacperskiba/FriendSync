from app.schemas.location import LocationCreate
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.location import LocationProposal, LocationVote


def create_location(db: Session, location_in: LocationCreate, event_id: int, user_id: int):
    db_location = LocationProposal(
        **location_in.model_dump(),
        event_id=event_id,
        creator_id=user_id
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


def get_locations_with_votes(db: Session, event_id: int):
    # Pobiera lokalizacje wraz z przeliczoną sumą głosów
    locations = db.query(LocationProposal).filter(LocationProposal.event_id == event_id).all()
    for loc in locations:
        loc.votes_count = sum(v.vote_value for v in loc.votes)
    return locations


def add_or_update_vote(db: Session, location_id: int, user_id: int, vote_value: int):
    db_vote = db.query(LocationVote).filter(
        LocationVote.location_id == location_id,
        LocationVote.user_id == user_id
    ).first()

    if db_vote:
        db_vote.vote_value = vote_value
    else:
        db_vote = LocationVote(location_id=location_id, user_id=user_id, vote_value=vote_value)
        db.add(db_vote)

    db.commit()
    return db_vote