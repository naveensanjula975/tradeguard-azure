"""Risk Rules API — read and update risk rule thresholds from the database."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from shared.database.connection import get_db
from shared.database.models import RiskRuleModel

router = APIRouter(prefix="/api/v1/risk-rules", tags=["Risk Rules"])

_DEFAULT_RULES = [
    {"code": "LARGE_ORDER",           "name": "Large Order",              "description": "Order value (qty×price) ≥ threshold", "threshold": 100000.0, "severity": "HIGH",     "enabled": True},
    {"code": "RAPID_CANCELLATION",    "name": "Rapid Cancellation",       "description": "≥10 order cancellations within 5 minutes",  "threshold": 10.0,     "severity": "HIGH",     "enabled": True},
    {"code": "EXCESSIVE_FREQUENCY",   "name": "Excessive Frequency",      "description": ">30 orders submitted within 1 minute",  "threshold": 30.0,     "severity": "MEDIUM",   "enabled": True},
    {"code": "UNUSUAL_VOLUME",        "name": "Unusual Volume",           "description": "Volume exceeds 3× historical average",  "threshold": 3.0,      "severity": "MEDIUM",   "enabled": True},
    {"code": "NEW_DEVICE_HIGH_VALUE", "name": "New Device & High Value",  "description": "New device flag with order value ≥ threshold",  "threshold": 50000.0,  "severity": "CRITICAL", "enabled": True},
    {"code": "WASH_TRADING",          "name": "Wash Trading",             "description": "Offsetting buy/sell on same instrument within 30s",  "threshold": 3.0,      "severity": "CRITICAL", "enabled": True},
    {"code": "SPOOFING_LAYERING",     "name": "Spoofing / Layering",      "description": "Rapid submission and cancellation of non-executable orders",  "threshold": 3.0,      "severity": "HIGH",     "enabled": True},
    {"code": "OFF_HOURS_TRADING",     "name": "Off-Hours Trading",        "description": "High-value trade outside market hours or on weekends",  "threshold": 25000.0,  "severity": "MEDIUM",   "enabled": True},
    {"code": "PRICE_SPIKE",           "name": "Price Spike",              "description": "Order price deviates ≥ threshold% from benchmark",  "threshold": 15.0,     "severity": "HIGH",     "enabled": True},
]


def _seed_rules(db: Session):
    """Seed default rules if the table is empty."""
    if db.query(RiskRuleModel).count() == 0:
        for r in _DEFAULT_RULES:
            db.add(RiskRuleModel(**r))
        db.commit()


class UpdateRuleRequest(BaseModel):
    threshold: float
    enabled: bool


@router.get("")
def list_risk_rules(db: Session = Depends(get_db)):
    """Return all configured risk rules (seeds defaults on first request)."""
    _seed_rules(db)
    rules = db.query(RiskRuleModel).order_by(RiskRuleModel.id).all()
    return [
        {
            "code": r.code,
            "name": r.name,
            "description": r.description,
            "threshold": r.threshold,
            "severity": r.severity,
            "enabled": r.enabled,
        }
        for r in rules
    ]


from .audit_logs import log_audit_event


@router.patch("/{rule_code}")
def update_risk_rule(rule_code: str, req: UpdateRuleRequest, db: Session = Depends(get_db)):
    """Update a risk rule's threshold and enabled flag by rule code."""
    rule = db.query(RiskRuleModel).filter(RiskRuleModel.code == rule_code).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule '{rule_code}' not found")
    
    old_val = f"threshold={rule.threshold}, enabled={rule.enabled}"
    rule.threshold = req.threshold
    rule.enabled = req.enabled
    db.commit()
    db.refresh(rule)
    new_val = f"threshold={rule.threshold}, enabled={rule.enabled}"

    log_audit_event(
        db=db,
        user_id="ANALYST-SYSTEM",
        entity_type="RISK_RULE",
        entity_id=rule_code,
        action="UPDATE_RULE",
        old_value=old_val,
        new_value=new_val,
    )

    return {"code": rule.code, "name": rule.name, "threshold": rule.threshold, "severity": rule.severity, "enabled": rule.enabled}
