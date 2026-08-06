"""Alert Processor — persists incoming AlertEvents to the database."""
from sqlalchemy.orm import Session
from shared.event_contracts import AlertEvent
from shared.database.models import AlertRecord
from shared.schemas.common import AlertStatus
from shared.observability import setup_logger

logger = setup_logger("alert-processor")


class AlertProcessor:
    def process_incoming_alert(self, alert: AlertEvent, db: Session) -> AlertRecord:
        """Persist an AlertEvent to the database and return the created record."""
        logger.info(f"Processing alert {alert.alert_id} ({alert.severity}) for trader {alert.trader_id}")

        existing = db.query(AlertRecord).filter(AlertRecord.alert_id == alert.alert_id).first()
        if existing:
            logger.warning(f"Alert {alert.alert_id} already exists — skipping duplicate.")
            return existing

        record = AlertRecord(
            alert_id=alert.alert_id,
            event_id=alert.event_id,
            trader_id=alert.trader_id,
            rule_code=alert.rule_code,
            title=alert.title,
            description=alert.description,
            rule_score=alert.rule_score,
            anomaly_score=alert.anomaly_score,
            final_risk_score=alert.final_risk_score,
            severity=alert.severity.value,
            status=AlertStatus.NEW.value,
            detected_at=alert.detected_at,
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(f"Alert {alert.alert_id} persisted (id={record.id})")
        return record


alert_processor = AlertProcessor()
