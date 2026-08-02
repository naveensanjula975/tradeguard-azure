from fastapi import APIRouter, HTTPException, status
from shared.event_contracts import TradeEvent
from services.ingestion-service.src.publisher import publisher

router = APIRouter(prefix="/api/v1", tags=["Events"])

processed_event_ids = set()

@router.post("/trade-events", status_code=status.HTTP_201_CREATED)
def receive_trade_event(event: TradeEvent):
    if event.event_id in processed_event_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Duplicate event_id: {event.event_id}"
        )
    
    success = publisher.publish_trade_event(event)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to publish trade event to Event Hubs"
        )

    processed_event_ids.add(event.event_id)
    return {"status": "accepted", "event_id": event.event_id}

@router.get("/trade-events/{event_id}")
def get_trade_event(event_id: str):
    if event_id not in processed_event_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event {event_id} not found"
        )
    return {"event_id": event_id, "status": "processed"}
