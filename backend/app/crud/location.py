from sqlalchemy.orm import Session
from app.models.location import LocationProposal, LocationVote
from app.schemas.location import LocationCreate
from app.services.geocoding import get_coordinates_from_address


def create_location(db: Session, location_in: LocationCreate, event_id: int, user_id: int):
    lat = location_in.latitude
    lon = location_in.longitude

    # Jeśli użytkownik podał adres zamiast współrzędnych, używamy Geocodingu
    if location_in.address and (lat is None or lon is None):
        coords = get_coordinates_from_address(location_in.address)
        lat = coords["lat"]
        lon = coords["lon"]

    if lat is None or lon is None:
        raise ValueError("Musisz podać współrzędne lub adres.")

    db_location = LocationProposal(
        name=location_in.name,
        latitude=lat,
        longitude=lon,
        description=location_in.description,
        event_id=event_id,
        creator_id=user_id
    )
    db.add(db_location)
    db.commit()
    db.refresh(db_location)
    return db_location


def get_locations_with_votes(db: Session, event_id: int):
    # Pobieramy lokalizacje i ręcznie mapujemy sumę głosów
    locations = db.query(LocationProposal).filter(LocationProposal.event_id == event_id).all()
    for loc in locations:
        loc.votes_count = sum(v.vote_value for v in loc.votes)
    return locations


def add_or_update_vote(db: Session, location_id: int, user_id: int, vote_value: int):
    # Szukamy istniejącego głosu
    db_vote = db.query(LocationVote).filter(
        LocationVote.location_id == location_id,
        LocationVote.user_id == user_id
    ).first()

    if vote_value == 1:
        # Jeśli użytkownik klika "ZA"
        if not db_vote:
            # Jeśli jeszcze nie głosował - dodajemy +1
            db_vote = LocationVote(location_id=location_id, user_id=user_id, vote_value=1)
            db.add(db_vote)

    elif vote_value == -1:
        # Jeśli użytkownik klika "W DÓŁ" - to u nas oznacza "USUŃ MÓJ GŁOS"
        if db_vote:
            db.delete(db_vote)

    db.commit()
    return {"status": "success"}


def delete_vote(db: Session, location_id: int, user_id: int):
    # Usuwanie głosu zgodnie z punktem 6 specyfikacji
    db_vote = db.query(LocationVote).filter(
        LocationVote.location_id == location_id,
        LocationVote.user_id == user_id
    ).first()
    if db_vote:
        db.delete(db_vote)
        db.commit()
        return True
    return False