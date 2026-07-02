from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from typing import List

from app.api.dependencies import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.event import Event
from app.models.date_proposal import DateProposal, DateVote
from app.schemas.event import DateProposalCreate, DateProposalResponse
from app.crud.event import get_event, get_participant
from app.crud.notification import create_notification

from app.api.websocket import manager

router = APIRouter(tags=["Date proposals"])


def _proposal_to_response(proposal: DateProposal, current_user_id: int) -> dict:
    return {
        "id": proposal.id,
        "event_id": proposal.event_id,
        "proposed_date": proposal.proposed_date,
        "creator": proposal.creator,
        "votes_count": len(proposal.votes),
        "voted_by_me": any(v.user_id == current_user_id for v in proposal.votes),
        "voters": [v.user.username for v in proposal.votes],
    }


def _get_proposal_or_404(db: Session, proposal_id: int) -> DateProposal:
    proposal = db.query(DateProposal).filter(DateProposal.id == proposal_id).first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Propozycja terminu nie istnieje.")
    return proposal


# --- LISTA PROPOZYCJI TERMINÓW ---
@router.get("/api/events/{event_id}/date-proposals", response_model=List[DateProposalResponse])
def read_date_proposals(
    event_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Zwraca propozycje terminów wydarzenia z liczbą głosów (posortowane malejąco)."""
    if not get_participant(db, event_id=event_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Brak dostępu do tego wydarzenia.")

    proposals = (
        db.query(DateProposal)
        .options(joinedload(DateProposal.votes).joinedload(DateVote.user), joinedload(DateProposal.creator))
        .filter(DateProposal.event_id == event_id)
        .all()
    )
    result = [_proposal_to_response(p, current_user.id) for p in proposals]
    # Najpopularniejsze na górze, przy remisie — wcześniejszy termin.
    result.sort(key=lambda p: (-p["votes_count"], p["proposed_date"]))
    return result


# --- DODANIE PROPOZYCJI ---
@router.post("/api/events/{event_id}/date-proposals", response_model=DateProposalResponse,
             status_code=status.HTTP_201_CREATED)
async def add_date_proposal(
    event_id: int,
    proposal_in: DateProposalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dodaje propozycję terminu. Autor automatycznie oddaje na nią głos."""
    if not get_event(db, event_id=event_id):
        raise HTTPException(status_code=404, detail="Wydarzenie nie istnieje.")
    if not get_participant(db, event_id=event_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Brak dostępu do tego wydarzenia.")

    duplicate = db.query(DateProposal).filter(
        DateProposal.event_id == event_id,
        DateProposal.proposed_date == proposal_in.proposed_date
    ).first()
    if duplicate:
        raise HTTPException(status_code=400, detail="Taki termin został już zaproponowany.")

    proposal = DateProposal(
        event_id=event_id,
        creator_id=current_user.id,
        proposed_date=proposal_in.proposed_date
    )
    db.add(proposal)
    db.flush()
    db.add(DateVote(proposal_id=proposal.id, user_id=current_user.id))
    db.commit()
    db.refresh(proposal)

    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return _proposal_to_response(proposal, current_user.id)


# --- USUNIĘCIE PROPOZYCJI ---
@router.delete("/api/date-proposals/{proposal_id}")
async def delete_date_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Usuwa propozycję terminu — może autor propozycji lub organizator wydarzenia."""
    proposal = _get_proposal_or_404(db, proposal_id)
    event = get_event(db, event_id=proposal.event_id)

    is_organizer = event and (event.creator_id == current_user.id
                              or getattr(event, 'owner_id', None) == current_user.id)
    if proposal.creator_id != current_user.id and not is_organizer:
        raise HTTPException(status_code=403, detail="Brak uprawnień do usunięcia tej propozycji.")

    event_id = proposal.event_id
    db.delete(proposal)
    db.commit()

    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return {"message": "Propozycja terminu usunięta."}


# --- GŁOSOWANIE ---
@router.post("/api/date-proposals/{proposal_id}/votes")
async def vote_date_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Oddaje głos na propozycję terminu."""
    proposal = _get_proposal_or_404(db, proposal_id)
    if not get_participant(db, event_id=proposal.event_id, user_id=current_user.id):
        raise HTTPException(status_code=403, detail="Brak dostępu do tego wydarzenia.")

    existing = db.query(DateVote).filter(
        DateVote.proposal_id == proposal_id,
        DateVote.user_id == current_user.id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Już zagłosowano na ten termin.")

    db.add(DateVote(proposal_id=proposal_id, user_id=current_user.id))
    db.commit()

    await manager.broadcast_to_event(proposal.event_id, {"type": "event_updated", "event_id": proposal.event_id}, db)
    return {"message": "Głos oddany."}


# --- WYCOFANIE GŁOSU ---
@router.delete("/api/date-proposals/{proposal_id}/votes")
async def unvote_date_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Wycofuje głos zalogowanego użytkownika."""
    proposal = _get_proposal_or_404(db, proposal_id)

    deleted = db.query(DateVote).filter(
        DateVote.proposal_id == proposal_id,
        DateVote.user_id == current_user.id
    ).delete()
    db.commit()
    if not deleted:
        raise HTTPException(status_code=404, detail="Głos nie został znaleziony.")

    await manager.broadcast_to_event(proposal.event_id, {"type": "event_updated", "event_id": proposal.event_id}, db)
    return {"message": "Głos wycofany."}


# --- ZATWIERDZENIE TERMINU (ORGANIZATOR) ---
@router.post("/api/date-proposals/{proposal_id}/accept")
async def accept_date_proposal(
    proposal_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Ustawia zaproponowany termin jako oficjalną datę wydarzenia i czyści pozostałe
    propozycje. Tylko organizator.
    """
    proposal = _get_proposal_or_404(db, proposal_id)
    event = db.query(Event).filter(Event.id == proposal.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Wydarzenie nie istnieje.")

    is_organizer = event.creator_id == current_user.id or getattr(event, 'owner_id', None) == current_user.id
    if not is_organizer:
        raise HTTPException(status_code=403, detail="Tylko organizator może zatwierdzić termin.")

    event.event_date = proposal.proposed_date
    event_id = event.id

    # Głosowanie zakończone — sprzątamy wszystkie propozycje tego wydarzenia.
    for p in db.query(DateProposal).filter(DateProposal.event_id == event_id).all():
        db.delete(p)
    db.commit()

    # Powiadom uczestników (poza organizatorem, który sam kliknął).
    for participant in event.participants:
        if participant.user_id != current_user.id:
            create_notification(
                db=db,
                user_id=participant.user_id,
                notif_type="event_date_set",
                message=f"Ustalono termin wydarzenia „{event.title}”."
            )

    await manager.broadcast_to_event(event_id, {"type": "event_updated", "event_id": event_id}, db)
    return {"message": "Termin wydarzenia zatwierdzony."}
