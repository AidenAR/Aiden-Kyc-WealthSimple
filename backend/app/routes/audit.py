import csv
import io
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.application import AuditLog
from app.schemas.application import AuditLogEntry, AuditLogResponse

router = APIRouter(prefix="/api/audit-log", tags=["audit"])


def _build_query(db: Session, application_id=None, action=None, actor=None):
    query = db.query(AuditLog)
    if application_id:
        query = query.filter(AuditLog.application_id == application_id)
    if action:
        query = query.filter(AuditLog.action == action)
    if actor:
        query = query.filter(AuditLog.actor == actor)
    return query


@router.get("", response_model=AuditLogResponse)
def get_audit_log(
    application_id: str | None = Query(None),
    action: str | None = Query(None),
    actor: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = _build_query(db, application_id, action, actor)
    total = query.count()
    entries = (
        query.order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return AuditLogResponse(
        entries=[AuditLogEntry.model_validate(e) for e in entries],
        total=total,
    )


@router.get("/export")
def export_audit_log(
    application_id: str | None = Query(None),
    action: str | None = Query(None),
    actor: str | None = Query(None),
    db: Session = Depends(get_db),
):
    query = _build_query(db, application_id, action, actor)
    entries = query.order_by(AuditLog.timestamp.desc()).limit(10000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "action", "actor", "application_id", "details"])
    for e in entries:
        details_str = ""
        if e.details:
            details_str = "; ".join(f"{k}={v}" for k, v in e.details.items() if v is not None)
        writer.writerow([
            e.timestamp.isoformat() if e.timestamp else "",
            e.action,
            e.actor,
            e.application_id or "",
            details_str,
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit_log.csv"},
    )
