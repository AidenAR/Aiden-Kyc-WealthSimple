from sqlalchemy.orm import Session
from app.models.application import AuditLog


def log_event(
    db: Session,
    action: str,
    actor: str,
    application_id: str | None = None,
    details: dict | None = None,
):
    entry = AuditLog(
        application_id=application_id,
        action=action,
        actor=actor,
        details=details,
    )
    db.add(entry)
    db.commit()
    return entry
