"""Investigation Notes API — create and list analyst notes per alert."""
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from shared.database.connection import get_db
from shared.database.models import AlertRecord
from ...services.case_manager import case_manager

router = APIRouter(prefix="/api/v1/alerts/{alert_id}/notes", tags=["Investigation Notes"])


class CreateNoteRequest(BaseModel):
    author_id: str
    note: str


@router.get("")
def list_notes(alert_id: str, db: Session = Depends(get_db)):
    record = db.query(AlertRecord).filter(AlertRecord.alert_id == alert_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")
    notes = case_manager.list_notes(alert_id, db)
    return {"alert_id": alert_id, "notes": [n.to_dict() for n in notes]}


from .audit_logs import log_audit_event


@router.post("", status_code=status.HTTP_201_CREATED)
def create_note(alert_id: str, req: CreateNoteRequest, db: Session = Depends(get_db)):
    record = db.query(AlertRecord).filter(AlertRecord.alert_id == alert_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")
    note = case_manager.add_note(alert_id, req.author_id, req.note, db)
    log_audit_event(
        db=db,
        user_id=req.author_id,
        entity_type="ALERT_NOTE",
        entity_id=alert_id,
        action="ADD_NOTE",
        new_value=req.note[:100],
    )
    return note.to_dict()
