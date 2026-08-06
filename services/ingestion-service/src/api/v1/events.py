"""Trade Event Ingestion API — validates and routes incoming trade events."""
from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from shared.event_contracts import TradeEvent
from shared.database.connection import get_db
from shared.database.models import TradeEventRecord
from services.ingestion_service.src.publisher import publisher

router = APIRouter(prefix="/api/v1", tags=["Events"])


@router.post("/trade-events", status_code=status.HTTP_201_CREATED)
def receive_trade_event(event: TradeEvent, db: Session = Depends(get_db)):
    """
    Receives, validates and persists a trade event, then forwards it to the risk engine.
    Returns 409 if the event_id has already been processed.
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

    # Forward to risk engine (async in prod via Event Hubs; direct HTTP in local dev)
    success = publisher.publish_trade_event(event)
    if not success:
        # Risk engine unreachable — event is already persisted so we warn rather than fail
        return {
            "status": "accepted_with_warning",
            "event_id": event.event_id,
            "warning": "Risk engine forwarding failed — event is persisted but evaluation may be delayed",
        }

    return {"status": "accepted", "event_id": event.event_id}


@router.get("/trade-events/{event_id}")
def get_trade_event(event_id: str, db: Session = Depends(get_db)):
    """Retrieve the status of a previously submitted trade event."""
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
