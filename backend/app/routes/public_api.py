import hashlib
import base64
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from typing import Optional

from app.database import get_db
from app.models.application import Application, Job, ApplicationStatus, ApiKey
from app.services import storage, audit

router = APIRouter(prefix="/api/v1", tags=["public-api"])


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def get_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db),
) -> ApiKey:
    key_obj = db.query(ApiKey).filter(
        ApiKey.key_hash == _hash_key(x_api_key),
        ApiKey.is_active == True,
    ).first()
    if not key_obj:
        raise HTTPException(401, "Invalid or revoked API key")
    key_obj.last_used_at = datetime.now(timezone.utc)
    db.commit()
    return key_obj


class VerifyRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    date_of_birth: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    address: str = Field(..., min_length=1)
    country: str = Field(..., min_length=1, max_length=100)
    document_type: str = Field(..., pattern=r"^(drivers_license|passport|national_id)$")
    email: Optional[str] = None
    document_base64: str = Field(..., description="Base64-encoded document image (JPEG, PNG, or PDF)")
    document_filename: str = Field(default="document.jpg")
    selfie_base64: str = Field(..., description="Base64-encoded selfie image")
    selfie_filename: str = Field(default="selfie.jpg")


class VerificationStatus(BaseModel):
    id: str
    status: str
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    confidence_score: Optional[float] = None
    decision: Optional[str] = None
    explanation: Optional[str] = None
    flags: Optional[list] = None
    extracted_data: Optional[dict] = None
    facial_match: Optional[dict] = None
    regulatory_priority: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    processing_error: Optional[str] = None


class VerificationListResponse(BaseModel):
    verifications: list[VerificationStatus]
    total: int
    page: int
    limit: int


def _to_status(app: Application) -> VerificationStatus:
    return VerificationStatus(
        id=app.id,
        status=app.status,
        risk_score=app.risk_score,
        risk_level=app.risk_level,
        confidence_score=app.confidence_score,
        decision=app.review_decision,
        explanation=app.ai_explanation,
        flags=app.flags,
        extracted_data=app.extracted_data,
        facial_match=app.facial_match,
        regulatory_priority=app.regulatory_priority,
        created_at=app.created_at,
        updated_at=app.updated_at,
        processing_error=app.processing_error,
    )


@router.post("/verify", status_code=202)
def submit_verification(
    req: VerifyRequest,
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(get_api_key),
):
    """Submit an identity verification request. Returns immediately with an ID — poll /status/{id} for results."""

    if not req.first_name.strip():
        raise HTTPException(400, "First name cannot be blank")
    if not req.last_name.strip():
        raise HTTPException(400, "Last name cannot be blank")
    if not req.address.strip():
        raise HTTPException(400, "Address cannot be blank")

    try:
        dob = date.fromisoformat(req.date_of_birth)
        if dob > date.today():
            raise HTTPException(400, "Date of birth cannot be in the future")
        if dob.year < 1900:
            raise HTTPException(400, "Invalid date of birth")
    except ValueError:
        raise HTTPException(400, "Invalid date of birth format (expected YYYY-MM-DD)")

    try:
        doc_bytes = base64.b64decode(req.document_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 encoding for document")
    try:
        selfie_bytes = base64.b64decode(req.selfie_base64)
    except Exception:
        raise HTTPException(400, "Invalid base64 encoding for selfie")

    if len(doc_bytes) == 0:
        raise HTTPException(400, "Document file is empty")
    if len(selfie_bytes) == 0:
        raise HTTPException(400, "Selfie file is empty")
    if len(doc_bytes) < 100:
        raise HTTPException(400, "Document file is too small to be a valid image")
    if len(selfie_bytes) < 100:
        raise HTTPException(400, "Selfie file is too small to be a valid image")
    if len(doc_bytes) > storage.MAX_FILE_SIZE:
        raise HTTPException(400, f"Document exceeds {storage.MAX_FILE_SIZE // (1024*1024)} MB limit")
    if len(selfie_bytes) > storage.MAX_FILE_SIZE:
        raise HTTPException(400, f"Selfie exceeds {storage.MAX_FILE_SIZE // (1024*1024)} MB limit")

    try:
        doc_filename = storage.save_document(doc_bytes, req.document_filename)
    except ValueError as e:
        raise HTTPException(400, f"Document: {str(e)}")
    try:
        selfie_filename = storage.save_document(selfie_bytes, req.selfie_filename)
    except ValueError as e:
        raise HTTPException(400, f"Selfie: {str(e)}")

    doc_hash = hashlib.sha256(doc_bytes).hexdigest()
    duplicate_warning: str | None = None
    existing = db.query(Application).filter(Application.document_hash == doc_hash).first()
    if existing:
        duplicate_warning = f"Document may be a duplicate of verification {existing.id}"

    app = Application(
        email=req.email,
        first_name=req.first_name.strip(),
        last_name=req.last_name.strip(),
        date_of_birth=req.date_of_birth,
        address=req.address.strip(),
        country=req.country.strip(),
        document_type=req.document_type,
        document_paths=[doc_filename],
        document_hash=doc_hash,
        selfie_path=selfie_filename,
        status=ApplicationStatus.SUBMITTED.value,
    )
    db.add(app)
    db.flush()

    job = Job(application_id=app.id, status="pending")
    db.add(job)
    db.commit()

    audit.log_event(
        db,
        action="api_verification_submitted",
        actor=f"api_key:{api_key.key_prefix}",
        application_id=app.id,
        details={"document_type": req.document_type, "api_key_name": api_key.name},
    )

    response = {
        "id": app.id,
        "status": app.status,
        "message": "Verification submitted. Poll GET /api/v1/status/{id} for results.",
    }
    if duplicate_warning:
        response["warning"] = duplicate_warning
    return response


@router.get("/status/{verification_id}", response_model=VerificationStatus)
def get_verification_status(
    verification_id: str,
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(get_api_key),
):
    """Check the status and results of a verification request."""
    app = db.query(Application).filter(Application.id == verification_id).first()
    if not app:
        raise HTTPException(404, "Verification not found")
    return _to_status(app)


@router.get("/verifications", response_model=VerificationListResponse)
def list_verifications(
    status: str | None = None,
    email: str | None = None,
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db),
    api_key: ApiKey = Depends(get_api_key),
):
    """List all verification requests submitted via this API."""
    query = db.query(Application)
    if status:
        query = query.filter(Application.status == status)
    if email:
        query = query.filter(Application.email == email)
    total = query.count()
    apps = query.order_by(Application.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return VerificationListResponse(
        verifications=[_to_status(a) for a in apps],
        total=total,
        page=page,
        limit=limit,
    )
