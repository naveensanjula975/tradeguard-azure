from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/risk-rules", tags=["Risk Rules"])

class UpdateRuleRequest(BaseModel):
    threshold: float
    enabled: bool

@router.get("")
def list_risk_rules():
    return [
        {"code": "LARGE_ORDER", "name": "Large Order", "threshold": 100000.0, "severity": "HIGH", "enabled": True},
        {"code": "RAPID_CANCELLATION", "name": "Rapid Cancellation", "threshold": 10.0, "severity": "HIGH", "enabled": True},
        {"code": "EXCESSIVE_FREQUENCY", "name": "Excessive Frequency", "threshold": 30.0, "severity": "MEDIUM", "enabled": True},
        {"code": "UNUSUAL_VOLUME", "name": "Unusual Volume", "threshold": 3.0, "severity": "MEDIUM", "enabled": True},
        {"code": "NEW_DEVICE_HIGH_VALUE", "name": "New Device & High Value", "threshold": 50000.0, "severity": "CRITICAL", "enabled": True},
    ]

@router.patch("/{rule_id}")
def update_risk_rule(rule_id: str, req: UpdateRuleRequest):
    return {"rule_id": rule_id, "threshold": req.threshold, "enabled": req.enabled}
