import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Float, Text, DateTime, Integer, JSON, Enum as SAEnum
)
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.database import Base


def _utcnow():
    return datetime.now(timezone.utc)


def _gen_id():
    return str(uuid.uuid4())


class ApplicationStatus(str, enum.Enum):
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    PROCESSING_FAILED = "processing_failed"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_INFO = "needs_info"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DocumentType(str, enum.Enum):
    DRIVERS_LICENSE = "drivers_license"
    PASSPORT = "passport"
    NATIONAL_ID = "national_id"


class Application(Base):
    __tablename__ = "applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_id)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, onupdate=_utcnow)

    # Applicant-submitted data
    email: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[str] = mapped_column(String(10))
    address: Mapped[str] = mapped_column(Text)
    country: Mapped[str] = mapped_column(String(100))
    document_type: Mapped[str] = mapped_column(String(20))
    document_paths: Mapped[list] = mapped_column(JSON, default=list)
    selfie_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_sample_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    voice_verification: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    facial_match: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Status
    status: Mapped[str] = mapped_column(
        String(20), default=ApplicationStatus.SUBMITTED.value
    )

    # AI analysis results
    risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    risk_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    confidence_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_explanation: Mapped[str | None] = mapped_column(Text, nullable=True)
    extracted_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    flags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    cross_reference_results: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    document_quality: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Review
    review_decision: Mapped[str | None] = mapped_column(String(20), nullable=True)
    review_reason: Mapped[str | None] = mapped_column(String(50), nullable=True)
    review_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    reviewed_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Evidence annotations from AI
    evidence_annotations: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Automatic regulatory screening results
    regulatory_flags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    regulatory_priority: Mapped[str | None] = mapped_column(String(20), nullable=True)

    # Processing metadata
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_id)
    application_id: Mapped[str] = mapped_column(String(36), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    locked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_id)
    application_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(50))
    actor: Mapped[str] = mapped_column(String(100))
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class WebhookLog(Base):
    __tablename__ = "webhook_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_id)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    direction: Mapped[str] = mapped_column(String(10))  # "incoming" or "outgoing"
    event_type: Mapped[str] = mapped_column(String(50))
    application_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    payload: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status_code: Mapped[int | None] = mapped_column(Integer, nullable=True)
    response_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="success")  # success / failed / pending
    error: Mapped[str | None] = mapped_column(Text, nullable=True)


class FeedbackEntry(Base):
    __tablename__ = "feedback_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_gen_id)
    application_id: Mapped[str] = mapped_column(String(36), index=True)
    feedback_type: Mapped[str] = mapped_column(String(50))
    category: Mapped[str] = mapped_column(String(100))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    ai_risk_level: Mapped[str | None] = mapped_column(String(10), nullable=True)
    ai_risk_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_by: Mapped[str] = mapped_column(String(100), default="compliance_officer")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
    status: Mapped[str] = mapped_column(String(20), default="pending")
