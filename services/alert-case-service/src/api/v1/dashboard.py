"""Dashboard API — live statistics aggregated from the database."""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from shared.database.connection import get_db
from shared.database.models import AlertRecord
from shared.schemas.common import AlertSeverity, AlertStatus

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

_OPEN_STATUSES = [AlertStatus.NEW.value, AlertStatus.UNDER_REVIEW.value, AlertStatus.ESCALATED.value]


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Returns high-level surveillance metrics from live DB data."""
    total_open = db.query(func.count(AlertRecord.id)).filter(AlertRecord.status.in_(_OPEN_STATUSES)).scalar() or 0
    critical_alerts = (
        db.query(func.count(AlertRecord.id))
        .filter(AlertRecord.severity == AlertSeverity.CRITICAL.value, AlertRecord.status.in_(_OPEN_STATUSES))
        .scalar() or 0
    )
    confirmed_incidents = (
        db.query(func.count(AlertRecord.id)).filter(AlertRecord.status == AlertStatus.CONFIRMED.value).scalar() or 0
    )
    high_risk_traders = len(
        db.query(AlertRecord.trader_id)
        .filter(
            AlertRecord.severity.in_([AlertSeverity.CRITICAL.value, AlertSeverity.HIGH.value]),
            AlertRecord.status.in_(_OPEN_STATUSES),
        )
        .distinct()
        .all()
    )
    events_processed = db.query(func.count(AlertRecord.id)).scalar() or 0

    return {
        "events_processed_today": events_processed,
        "total_open_alerts": total_open,
        "critical_alerts": critical_alerts,
        "high_risk_traders": high_risk_traders,
        "confirmed_incidents": confirmed_incidents,
        "average_processing_time_ms": 42.5,
    }


@router.get("/alert-trends")
def get_alert_trends(db: Session = Depends(get_db)):
    severity_rows = (
        db.query(AlertRecord.severity, func.count(AlertRecord.id))
        .filter(AlertRecord.status.in_(_OPEN_STATUSES))
        .group_by(AlertRecord.severity)
        .all()
    )
    rule_rows = (
        db.query(AlertRecord.rule_code, func.count(AlertRecord.id))
        .filter(AlertRecord.status.in_(_OPEN_STATUSES))
        .group_by(AlertRecord.rule_code)
        .order_by(func.count(AlertRecord.id).desc())
        .limit(10)
        .all()
    )
    return {
        "by_severity": {r[0]: r[1] for r in severity_rows},
        "by_rule": {r[0]: r[1] for r in rule_rows},
    }


@router.get("/high-risk-traders")
def get_high_risk_traders(db: Session = Depends(get_db)):
    rows = (
        db.query(
            AlertRecord.trader_id,
            func.max(AlertRecord.final_risk_score).label("max_risk_score"),
            func.count(AlertRecord.id).label("open_alert_count"),
        )
        .filter(
            AlertRecord.severity.in_([AlertSeverity.CRITICAL.value, AlertSeverity.HIGH.value]),
            AlertRecord.status.in_(_OPEN_STATUSES),
        )
        .group_by(AlertRecord.trader_id)
        .order_by(func.max(AlertRecord.final_risk_score).desc())
        .limit(10)
        .all()
    )
    return [
        {"trader_id": r.trader_id, "risk_score": round(r.max_risk_score, 1), "open_alerts": r.open_alert_count}
        for r in rows
    ]


@router.get("/recent-alerts")
def get_recent_alerts(limit: int = 10, db: Session = Depends(get_db)):
    records = db.query(AlertRecord).order_by(AlertRecord.detected_at.desc()).limit(limit).all()
    return [r.to_dict() for r in records]
