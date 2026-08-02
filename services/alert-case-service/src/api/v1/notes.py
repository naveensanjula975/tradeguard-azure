from fastapi import APIRouter, status
from pydantic import BaseModel

router = APIRouter(prefix="/api/v1/alerts/{alert_id}/notes", tags=["Investigation Notes"])

class CreateNoteRequest(BaseModel):
    author_id: str
    note: str

@router.get("")
def list_notes(alert_id: str):
    return {"alert_id": alert_id, "notes": []}

@router.post("", status_code=status.HTTP_201_CREATED)
def create_note(alert_id: str, req: CreateNoteRequest):
    return {
        "id": 1,
        "alert_id": alert_id,
        "author_id": req.author_id,
        "note": req.note,
        "status": "created"
    }
