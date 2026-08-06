"""Trade Event Ingestion API — validates and routes incoming trade events."""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from shared.event_contracts import TradeEvent
from shared.database.connection import get_db
from shared.database.models import TradeEventRecord
from ..publisher import publisher

router = APIRouter(prefix="/api/v1", tags=["Events"])


@router.post("/trade-events", status_code=status.HTTP_201_CREATED)
def receive_trade_event(event: TradeEvent, db: Session = Depends(get_db)):
    """
    Receives, validates, persists, and routes a trade event for risk evaluation.
    Returns 409 Conflict if the event_id has already been processed (idempotency).
    """
    # Idempotency check via database
    existing = db.query(TradeEventRecord).filter(TradeEventRecord.event_id == event.event_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate event_id: {event.event_id}",
        )

    # Persist the trade event record
    record = TradeEventRecord(
        event_id=event.event_id,
        event_type=event.event_type.value,
        trader_id=event.trader_id,
        account_id=event.account_id,
        instrument=event.instrument,
        side=event.side.value,
        quantity=event.quantity,
        price=event.price,
        device_id=event.device_id,
        ip_address=event.ip_address,
        country=event.country,
        event_timestamp=event.timestamp,
    )
    db.add(record)
    db.commit()

    # Forward to risk engine (direct HTTP in dev, Event Hubs in prod)
    success = publisher.publish_trade_event(event)
    if not success:
        return {
            "status": "accepted_with_warning",
            "event_id": event.event_id,
            "warning": "Risk engine forwarding failed — event persisted, evaluation may be delayed",
        }

    return {"status": "accepted", "event_id": event.event_id}


@router.get("/trade-events/{event_id}")
def get_trade_event(event_id: str, db: Session = Depends(get_db)):
    """Retrieve the processing status of a previously submitted trade event."""
    record = db.query(TradeEventRecord).filter(TradeEventRecord.event_id == event_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found",
        )
    return {
        "event_id": record.event_id,
        "trader_id": record.trader_id,
        "instrument": record.instrument,
        "event_type": record.event_type,
        "status": "processed",
        "received_at": record.received_at.isoformat() if record.received_at else None,
    }
