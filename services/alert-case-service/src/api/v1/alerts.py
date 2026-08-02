from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, status
from pydantic import BaseModel
from shared.schemas import AlertSeverity, AlertStatus

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
    limit: int = 50,
    offset: int = 0
):
    # Dummy returned list for API scaffolding
    return {
        "total": 0,
        "items": [],
        "limit": limit,
        "offset": offset
    }

@router.get("/{alert_id}")
def get_alert(alert_id: str):
    return {
        "alert_id": alert_id,
        "title": "High-value order from new device",
        "severity": AlertSeverity.CRITICAL,
        "status": AlertStatus.NEW,
        "risk_score": 91.4
    }

@router.patch("/{alert_id}/status")
def update_alert_status(alert_id: str, req: StatusUpdateRequest):
    return {"alert_id": alert_id, "new_status": req.status}

@router.patch("/{alert_id}/assign")
def assign_alert(alert_id: str, req: AssignRequest):
    return {"alert_id": alert_id, "assigned_to": req.analyst_id}
