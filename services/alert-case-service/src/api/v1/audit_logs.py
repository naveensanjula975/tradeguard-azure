"""Audit Logs API — query and record compliance audit logs."""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from shared.database.connection import get_db
from shared.database.models import AuditLogModel

router = APIRouter(prefix="/api/v1/audit-logs", tags=["Audit Logs"])


def log_audit_event(
    db: Session,
    user_id: str,
    entity_type: str,
    entity_id: str,
    action: str,
    old_value: Optional[str] = None,
    new_value: Optional[str] = None,
) -> AuditLogModel:
    """Helper function to record an immutable audit log entry in the database."""
    entry = AuditLogModel(
        user_id=user_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("")
def list_audit_logs(
    user_id: Optional[str] = None,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Retrieve audit logs with optional filtering by user, entity type, or entity ID."""
    query = db.query(AuditLogModel)

    if user_id:
        query = query.filter(AuditLogModel.user_id == user_id)
    if entity_type:
        query = query.filter(AuditLogModel.entity_type == entity_type)
    if entity_id:
        query = query.filter(AuditLogModel.entity_id == entity_id)

    total = query.count()
    items = (
        query.order_by(AuditLogModel.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "items": [
            {
                "id": item.id,
                "user_id": item.user_id,
                "entity_type": item.entity_type,
                "entity_id": item.entity_id,
                "action": item.action,
                "old_value": item.old_value,
                "new_value": item.new_value,
                "created_at": item.created_at.isoformat() if item.created_at else None,
            }
            for item in items
        ],
        "limit": limit,
        "offset": offset,
    }
