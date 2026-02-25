from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from app.database import get_db
from app.models.application import Application, ApplicationStatus, FeedbackEntry
from app.schemas.application import StatsResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)):
    total = db.query(func.count(Application.id)).scalar() or 0

    def count_status(status: str) -> int:
        return db.query(func.count(Application.id)).filter(Application.status == status).scalar() or 0

    def count_risk(level: str) -> int:
        return (
            db.query(func.count(Application.id))
            .filter(
                Application.risk_level == level,
                Application.status == ApplicationStatus.PENDING_REVIEW.value,
            )
            .scalar()
            or 0
        )

    avg_risk = (
        db.query(func.avg(Application.risk_score))
        .filter(Application.risk_score.isnot(None))
        .scalar()
    )
    avg_confidence = (
        db.query(func.avg(Application.confidence_score))
        .filter(Application.confidence_score.isnot(None))
        .scalar()
    )

    approved = count_status(ApplicationStatus.APPROVED.value)
    rejected = count_status(ApplicationStatus.REJECTED.value)
    reviewed_total = approved + rejected
    approval_rate = round(approved / reviewed_total, 3) if reviewed_total > 0 else None

    risk_distribution = (
        db.query(Application.risk_level, func.count(Application.id))
        .filter(Application.risk_level.isnot(None))
        .group_by(Application.risk_level)
        .all()
    )
    risk_dist = {level: count for level, count in risk_distribution}

    status_distribution = (
        db.query(Application.status, func.count(Application.id))
        .group_by(Application.status)
        .all()
    )
    status_dist = {status: count for status, count in status_distribution}

    feedback_queue = (
        db.query(func.count(FeedbackEntry.id))
        .filter(FeedbackEntry.status == "pending")
        .scalar() or 0
    )

    return StatsResponse(
        total_applications=total,
        pending_review=count_status(ApplicationStatus.PENDING_REVIEW.value),
        approved=approved,
        rejected=rejected,
        processing=count_status(ApplicationStatus.PROCESSING.value),
        processing_failed=count_status(ApplicationStatus.PROCESSING_FAILED.value),
        needs_info=count_status(ApplicationStatus.NEEDS_INFO.value),
        high_risk=count_risk("high"),
        medium_risk=count_risk("medium"),
        low_risk=count_risk("low"),
        average_risk_score=round(avg_risk, 3) if avg_risk else None,
        average_confidence=round(avg_confidence, 3) if avg_confidence else None,
        approval_rate=approval_rate,
        risk_distribution=risk_dist,
        status_distribution=status_dist,
        feedback_queue_size=feedback_queue,
    )
