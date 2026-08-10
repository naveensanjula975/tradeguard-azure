"""Alert API — full DB-backed CRUD for risk alerts."""
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from shared.schemas import AlertSeverity, AlertStatus
from shared.database.connection import get_db
from shared.database.models import AlertRecord
from shared.event_contracts import AlertEvent
from ...services.alert_processor import alert_processor
from ...services.case_manager import case_manager

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


class StatusUpdateRequest(BaseModel):
    status: AlertStatus


class AssignRequest(BaseModel):
    analyst_id: str


@router.get("")
def list_alerts(
    severity: Optional[AlertSeverity] = None,
    status_filter: Optional[AlertStatus] = Query(None, alias="status"),
    trader_id: Optional[str] = None,
    rule_code: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """List alerts with optional filters for severity, status, trader, and rule code."""
    query = db.query(AlertRecord)
    if severity:
        query = query.filter(AlertRecord.severity == severity.value)
    if status_filter:
        query = query.filter(AlertRecord.status == status_filter.value)
    if trader_id:
        query = query.filter(AlertRecord.trader_id == trader_id)
    if rule_code:
        query = query.filter(AlertRecord.rule_code == rule_code)

    total = query.count()
    items = (
        query.order_by(AlertRecord.detected_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"total": total, "items": [r.to_dict() for r in items], "limit": limit, "offset": offset}


@router.post("", status_code=status.HTTP_201_CREATED)
def ingest_alert(event: AlertEvent, db: Session = Depends(get_db)):
    """Receive and persist an alert from the risk engine."""
    record = alert_processor.process_incoming_alert(event, db)
    return record.to_dict()


@router.get("/{alert_id}")
def get_alert(alert_id: str, db: Session = Depends(get_db)):
    record = db.query(AlertRecord).filter(AlertRecord.alert_id == alert_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")
    return record.to_dict()


from .audit_logs import log_audit_event


@router.patch("/{alert_id}/status")
def update_alert_status(alert_id: str, req: StatusUpdateRequest, db: Session = Depends(get_db)):
    old_record = db.query(AlertRecord).filter(AlertRecord.alert_id == alert_id).first()
    old_status = old_record.status if old_record else None

    record = case_manager.update_status(alert_id, req.status, db)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")

    log_audit_event(
        db=db,
        user_id="ANALYST-SYSTEM",
        entity_type="ALERT",
        entity_id=alert_id,
        action="UPDATE_STATUS",
        old_value=old_status,
        new_value=req.status.value,
    )
    return {"alert_id": alert_id, "new_status": record.status}


@router.patch("/{alert_id}/assign")
def assign_alert(alert_id: str, req: AssignRequest, db: Session = Depends(get_db)):
    old_record = db.query(AlertRecord).filter(AlertRecord.alert_id == alert_id).first()
    old_assigned = old_record.assigned_to if old_record else None

    record = case_manager.assign_alert(alert_id, req.analyst_id, db)
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")

    log_audit_event(
        db=db,
        user_id=req.analyst_id,
        entity_type="ALERT",
        entity_id=alert_id,
        action="ASSIGN_ANALYST",
        old_value=old_assigned,
        new_value=req.analyst_id,
    )
    return {"alert_id": alert_id, "assigned_to": record.assigned_to}
