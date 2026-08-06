"""Dashboard API — real-time statistics from the database."""
from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session
from shared.database.connection import get_db
from shared.database.models import AlertRecord
from shared.schemas.common import AlertSeverity, AlertStatus

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])

_OPEN_STATUSES = [AlertStatus.NEW.value, AlertStatus.UNDER_REVIEW.value, AlertStatus.ESCALATED.value]


@router.get("/summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Returns high-level surveillance metrics from live DB data."""
    total_open = (
        db.query(func.count(AlertRecord.id))
        .filter(AlertRecord.status.in_(_OPEN_STATUSES))
        .scalar() or 0
    )

    critical_alerts = (
        db.query(func.count(AlertRecord.id))
        .filter(
            AlertRecord.severity == AlertSeverity.CRITICAL.value,
            AlertRecord.status.in_(_OPEN_STATUSES),
        )
        .scalar() or 0
    )

    confirmed_incidents = (
        db.query(func.count(AlertRecord.id))
        .filter(AlertRecord.status == AlertStatus.CONFIRMED.value)
        .scalar() or 0
    )

    # High-risk traders = traders with ≥1 CRITICAL or HIGH open alert
    high_risk_trader_ids = (
        db.query(AlertRecord.trader_id)
        .filter(
            AlertRecord.severity.in_([AlertSeverity.CRITICAL.value, AlertSeverity.HIGH.value]),
            AlertRecord.status.in_(_OPEN_STATUSES),
        )
        .distinct()
        .all()
    )
    high_risk_traders = len(high_risk_trader_ids)

    # Total events processed = total alert records (as proxy; ingestion writes TradeEventRecord separately)
    events_processed = (
        db.query(func.count(AlertRecord.id)).scalar() or 0
    )

    return {
        "events_processed_today": events_processed,
        "total_open_alerts": total_open,
        "critical_alerts": critical_alerts,
        "high_risk_traders": high_risk_traders,
        "confirmed_incidents": confirmed_incidents,
        "average_processing_time_ms": 42.5,  # Placeholder — wire APM metrics for real value
    }


@router.get("/alert-trends")
def get_alert_trends(db: Session = Depends(get_db)):
    """Returns alert distribution by severity and by rule code."""
    # By severity
    severity_rows = (
        db.query(AlertRecord.severity, func.count(AlertRecord.id))
        .filter(AlertRecord.status.in_(_OPEN_STATUSES))
        .group_by(AlertRecord.severity)
        .all()
    )
    by_severity = {row[0]: row[1] for row in severity_rows}

    # By rule code
    rule_rows = (
        db.query(AlertRecord.rule_code, func.count(AlertRecord.id))
        .filter(AlertRecord.status.in_(_OPEN_STATUSES))
        .group_by(AlertRecord.rule_code)
        .order_by(func.count(AlertRecord.id).desc())
        .limit(10)
        .all()
    )
    by_rule = {row[0]: row[1] for row in rule_rows}

    return {
        "by_severity": by_severity,
        "by_rule": by_rule,
    }


@router.get("/high-risk-traders")
def get_high_risk_traders(db: Session = Depends(get_db)):
    """Returns traders with the most open critical/high alerts ranked by max risk score."""
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
        {
            "trader_id": row.trader_id,
            "risk_score": round(row.max_risk_score, 1),
            "open_alerts": row.open_alert_count,
        }
        for row in rows
    ]


@router.get("/recent-alerts")
def get_recent_alerts(limit: int = 10, db: Session = Depends(get_db)):
    """Returns the most recent alerts for the dashboard feed."""
    records = (
        db.query(AlertRecord)
        .order_by(AlertRecord.detected_at.desc())
        .limit(limit)
        .all()
    )
    return [r.to_dict() for r in records]
