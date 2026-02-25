from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class ApplicationCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    address: str = Field(..., min_length=1)
    country: str = Field(..., min_length=1, max_length=100)
    document_type: str = Field(..., pattern=r"^(drivers_license|passport|national_id)$")


class Flag(BaseModel):
    description: str
    severity: str  # critical, warning, info
    field: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: str
    created_at: datetime
    updated_at: datetime
    email: Optional[str] = None
    first_name: str
    last_name: str
    date_of_birth: str
    address: str
    country: str
    document_type: str
    status: str

    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    confidence_score: Optional[float] = None
    ai_explanation: Optional[str] = None
    extracted_data: Optional[dict] = None
    flags: Optional[list] = None
    cross_reference_results: Optional[dict] = None
    document_quality: Optional[dict] = None

    review_decision: Optional[str] = None
    review_reason: Optional[str] = None
    review_notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None

    evidence_annotations: Optional[list] = None
    regulatory_flags: Optional[list] = None
    regulatory_priority: Optional[str] = None

    voice_verification: Optional[dict] = None
    facial_match: Optional[dict] = None

    retry_count: int = 0
    processing_error: Optional[str] = None
    document_urls: list[str] = []
    selfie_url: Optional[str] = None
    voice_url: Optional[str] = None

    model_config = {"from_attributes": True}


class ReviewRequest(BaseModel):
    decision: str = Field(..., pattern=r"^(approved|rejected|needs_info)$")
    reason: str = Field(..., min_length=1, max_length=200)
    notes: Optional[str] = None
    reviewer: str = Field(default="compliance_officer")


class ApplicationListResponse(BaseModel):
    applications: list[ApplicationResponse]
    total: int
    page: int
    limit: int


class AuditLogEntry(BaseModel):
    id: str
    application_id: Optional[str] = None
    action: str
    actor: str
    timestamp: datetime
    details: Optional[dict] = None

    model_config = {"from_attributes": True}


class AuditLogResponse(BaseModel):
    entries: list[AuditLogEntry]
    total: int


class StatsResponse(BaseModel):
    total_applications: int
    pending_review: int
    approved: int
    rejected: int
    processing: int
    processing_failed: int
    needs_info: int
    high_risk: int
    medium_risk: int
    low_risk: int
    average_risk_score: Optional[float] = None
    average_confidence: Optional[float] = None
    approval_rate: Optional[float] = None
    risk_distribution: dict[str, int] = {}
    status_distribution: dict[str, int] = {}
    feedback_queue_size: int = 0


class FeedbackRequest(BaseModel):
    feedback_type: str = Field(..., pattern=r"^(disagree_risk|disagree_extraction|false_positive_flag|missing_flag|other)$")
    category: str = Field(..., min_length=1, max_length=200)
    notes: Optional[str] = None
    reviewer: str = Field(default="compliance_officer")


class FeedbackEntryResponse(BaseModel):
    id: str
    application_id: str
    feedback_type: str
    category: str
    notes: Optional[str] = None
    ai_risk_level: Optional[str] = None
    ai_risk_score: Optional[float] = None
    created_by: str
    created_at: datetime
    status: str

    model_config = {"from_attributes": True}


class FeedbackQueueResponse(BaseModel):
    entries: list[FeedbackEntryResponse]
    total: int


class RegulatorySimRequest(BaseModel):
    pep_match: bool = False
    high_risk_country: bool = False
    sanctions_hit: bool = False
    adverse_media: bool = False


class RegulatorySimResponse(BaseModel):
    original_risk_score: Optional[float]
    original_risk_level: Optional[str]
    adjusted_risk_score: float
    adjusted_risk_level: str
    adjustments: list[dict]
    fintrac_flags: list[str]
    priority: str
    explanation: str


class AdversarialScenario(BaseModel):
    id: str
    name: str
    description: str
    attack_type: str
    expected_outcome: str


class AdversarialTestResponse(BaseModel):
    application_id: str
    scenario: AdversarialScenario
    message: str
