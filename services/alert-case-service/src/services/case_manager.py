"""Case Manager — handles investigation notes and alert workflow."""
from sqlalchemy.orm import Session
from shared.database.models import AlertRecord, CaseNoteModel
from shared.schemas.common import AlertStatus
from shared.observability import setup_logger

logger = setup_logger("case-manager")


class CaseManager:
    def add_note(self, alert_id: str, author_id: str, note: str, db: Session) -> CaseNoteModel:
        logger.info(f"Adding note to alert {alert_id} by {author_id}")
        record = CaseNoteModel(alert_id=alert_id, author_id=author_id, note=note)
        db.add(record)
        db.commit()
        db.refresh(record)
        return record

    def list_notes(self, alert_id: str, db: Session) -> list[CaseNoteModel]:
        return (
            db.query(CaseNoteModel)
            .filter(CaseNoteModel.alert_id == alert_id)
            .order_by(CaseNoteModel.created_at)
            .all()
        )

    def update_status(self, alert_id: str, new_status: AlertStatus, db: Session) -> AlertRecord | None:
        record = db.query(AlertRecord).filter(AlertRecord.alert_id == alert_id).first()
        if record:
            logger.info(f"Updating alert {alert_id}: {record.status} → {new_status.value}")
            record.status = new_status.value
            db.commit()
            db.refresh(record)
        return record

    def assign_alert(self, alert_id: str, analyst_id: str, db: Session) -> AlertRecord | None:
        record = db.query(AlertRecord).filter(AlertRecord.alert_id == alert_id).first()
        if record:
            logger.info(f"Assigning alert {alert_id} to {analyst_id}")
            record.assigned_to = analyst_id
            db.commit()
            db.refresh(record)
        return record


case_manager = CaseManager()
