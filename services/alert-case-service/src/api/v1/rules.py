"""Risk Rules API — read and update risk rule thresholds from the database."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from shared.database.connection import get_db
from shared.database.models import RiskRuleModel
from shared.schemas.common import AlertSeverity

router = APIRouter(prefix="/api/v1/risk-rules", tags=["Risk Rules"])

# Seed data matching the evaluator's rule set
_DEFAULT_RULES = [
    {"code": "LARGE_ORDER",          "name": "Large Order",              "threshold": 100000.0, "severity": "HIGH",     "enabled": True},
    {"code": "RAPID_CANCELLATION",   "name": "Rapid Cancellation",       "threshold": 10.0,     "severity": "HIGH",     "enabled": True},
    {"code": "EXCESSIVE_FREQUENCY",  "name": "Excessive Frequency",      "threshold": 30.0,     "severity": "MEDIUM",   "enabled": True},
    {"code": "UNUSUAL_VOLUME",       "name": "Unusual Volume",           "threshold": 3.0,      "severity": "MEDIUM",   "enabled": True},
    {"code": "NEW_DEVICE_HIGH_VALUE","name": "New Device & High Value",  "threshold": 50000.0,  "severity": "CRITICAL", "enabled": True},
    {"code": "WASH_TRADING",         "name": "Wash Trading",             "threshold": 3.0,      "severity": "CRITICAL", "enabled": True},
    {"code": "SPOOFING_LAYERING",    "name": "Spoofing / Layering",      "threshold": 3.0,      "severity": "HIGH",     "enabled": True},
    {"code": "OFF_HOURS_TRADING",    "name": "Off-Hours Trading",        "threshold": 50000.0,  "severity": "MEDIUM",   "enabled": True},
    {"code": "PRICE_SPIKE",          "name": "Price Spike",              "threshold": 5.0,      "severity": "HIGH",     "enabled": True},
]


def _seed_rules(db: Session):
    """Insert default rules if the table is empty."""
    if db.query(RiskRuleModel).count() == 0:
        for r in _DEFAULT_RULES:
            db.add(RiskRuleModel(**r))
        db.commit()


class UpdateRuleRequest(BaseModel):
    threshold: float
    enabled: bool


@router.get("")
def list_risk_rules(db: Session = Depends(get_db)):
    """Return all configured risk rules (seeds defaults on first call)."""
    _seed_rules(db)
    rules = db.query(RiskRuleModel).order_by(RiskRuleModel.id).all()
    return [
        {
            "code": r.code,
            "name": r.name,
            "threshold": r.threshold,
            "severity": r.severity,
            "enabled": r.enabled,
            "description": r.description,
        }
        for r in rules
    ]


@router.patch("/{rule_code}")
def update_risk_rule(rule_code: str, req: UpdateRuleRequest, db: Session = Depends(get_db)):
    """Update a risk rule's threshold and enabled flag."""
    rule = db.query(RiskRuleModel).filter(RiskRuleModel.code == rule_code).first()
    if not rule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Rule '{rule_code}' not found")

    rule.threshold = req.threshold
    rule.enabled = req.enabled
    db.commit()
    db.refresh(rule)

    return {
        "code": rule.code,
        "name": rule.name,
        "threshold": rule.threshold,
        "severity": rule.severity,
        "enabled": rule.enabled,
    }
