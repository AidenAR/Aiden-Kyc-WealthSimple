from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.application import Application, FeedbackEntry
from app.schemas.application import (
    FeedbackRequest,
    FeedbackEntryResponse,
    FeedbackQueueResponse,
)
from app.services import audit

router = APIRouter(prefix="/api", tags=["feedback"])

FEEDBACK_CATEGORIES = {
    "disagree_risk": [
        "Risk too high — legitimate applicant",
        "Risk too low — suspicious indicators missed",
        "Confidence score inaccurate",
    ],
    "disagree_extraction": [
        "Name extracted incorrectly",
        "DOB extracted incorrectly",
        "Document number wrong",
        "Expiry date misread",
    ],
    "false_positive_flag": [
        "Blur detection false positive",
        "Legitimate name variation (cultural/transliteration)",
        "Address format difference, not mismatch",
        "Document style unfamiliar to AI, but valid",
    ],
    "missing_flag": [
        "Missed tampering indicator",
        "Missed expired document",
        "Missed name discrepancy",
        "Missed quality issue",
    ],
    "other": [
        "Other — see notes",
    ],
}


@router.get("/feedback/categories")
def get_feedback_categories():
    return FEEDBACK_CATEGORIES


@router.post("/applications/{application_id}/feedback", response_model=FeedbackEntryResponse)
def submit_feedback(
    application_id: str,
    feedback: FeedbackRequest,
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    entry = FeedbackEntry(
        application_id=application_id,
        feedback_type=feedback.feedback_type,
        category=feedback.category,
        notes=feedback.notes,
        ai_risk_level=app.risk_level,
        ai_risk_score=app.risk_score,
        created_by=feedback.reviewer,
        status="pending",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    audit.log_event(
        db,
        action="reviewer_feedback",
        actor=feedback.reviewer,
        application_id=application_id,
        details={
            "feedback_type": feedback.feedback_type,
            "category": feedback.category,
            "notes": feedback.notes,
            "ai_risk_level": app.risk_level,
            "ai_risk_score": app.risk_score,
        },
    )

    return FeedbackEntryResponse.model_validate(entry)


@router.get("/feedback-queue", response_model=FeedbackQueueResponse)
def get_feedback_queue(
    status: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(FeedbackEntry)
    if status:
        query = query.filter(FeedbackEntry.status == status)

    total = query.count()
    entries = (
        query.order_by(FeedbackEntry.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return FeedbackQueueResponse(
        entries=[FeedbackEntryResponse.model_validate(e) for e in entries],
        total=total,
    )


@router.patch("/feedback/{feedback_id}/acknowledge")
def acknowledge_feedback(feedback_id: str, db: Session = Depends(get_db)):
    entry = db.query(FeedbackEntry).filter(FeedbackEntry.id == feedback_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Feedback entry not found")
    entry.status = "acknowledged"
    db.commit()
    return {"id": entry.id, "status": entry.status}
