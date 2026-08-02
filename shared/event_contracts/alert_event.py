from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from shared.schemas.common import AlertSeverity, AlertStatus

class AlertEvent(BaseModel):
    alert_id: str = Field(..., description="Unique alert identifier e.g. ALT-7001")
    event_id: str = Field(..., description="Associated trade event ID")
    trader_id: str = Field(..., description="Trader identifier e.g. TRD-1001")
    rule_code: str = Field(..., description="Rule code e.g. NEW_DEVICE_HIGH_VALUE")
    title: str = Field(..., description="Human readable alert summary")
    description: Optional[str] = Field(default=None, description="Detailed explanation")
    rule_score: float = Field(..., ge=0, le=100, description="Rule severity score (0-100)")
    anomaly_score: float = Field(..., ge=0, le=100, description="ML Anomaly score (0-100)")
    final_risk_score: float = Field(..., ge=0, le=100, description="Composite final risk score (0-100)")
    severity: AlertSeverity = Field(..., description="Calculated alert severity level")
    status: AlertStatus = Field(default=AlertStatus.NEW, description="Workflow status")
    detected_at: datetime = Field(default_factory=datetime.utcnow, description="Detection timestamp")
