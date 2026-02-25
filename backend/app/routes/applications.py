from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models.application import Application, Job, ApplicationStatus
from app.schemas.application import (
    ApplicationResponse,
    ApplicationListResponse,
    ReviewRequest,
)
from app.services import storage, audit
from app.services.webhooks import simulate_outgoing_webhook
from app.services.rate_limiter import check_rate_limit

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _to_response(app: Application, base_url: str = "") -> ApplicationResponse:
    data = ApplicationResponse.model_validate(app)
    paths = app.document_paths or []
    data.document_urls = [
        f"/api/applications/{app.id}/document/{i}" for i in range(len(paths))
    ]
    if app.selfie_path:
        data.selfie_url = f"/api/applications/{app.id}/selfie"
    if app.voice_sample_path:
        data.voice_url = f"/api/applications/{app.id}/voice"
    return data


@router.post("", status_code=202)
async def submit_application(
    request: Request,
    email: str = Form(""),
    first_name: str = Form(...),
    last_name: str = Form(...),
    date_of_birth: str = Form(...),
    address: str = Form(...),
    country: str = Form(...),
    document_type: str = Form(...),
    documents: list[UploadFile] = File(...),
    selfie: UploadFile = File(...),
    voice_sample: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

    if document_type not in ("drivers_license", "passport", "national_id"):
        raise HTTPException(status_code=400, detail="Invalid document type")

    if not documents or len(documents) == 0:
        raise HTTPException(status_code=400, detail="At least one document is required")
    if len(documents) > 5:
        raise HTTPException(status_code=400, detail="Maximum 5 documents per application")

    doc_filenames: list[str] = []
    for doc in documents:
        doc_bytes = await doc.read()
        if len(doc_bytes) > storage.MAX_FILE_SIZE:
            raise HTTPException(status_code=400, detail=f"File '{doc.filename}' exceeds {storage.MAX_FILE_SIZE // (1024*1024)} MB limit")
        try:
            filename = storage.save_document(doc_bytes, doc.filename or "document.jpg")
            doc_filenames.append(filename)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

    selfie_bytes = await selfie.read()
    if len(selfie_bytes) == 0:
        raise HTTPException(status_code=400, detail="Selfie photo is required for identity verification")
    try:
        selfie_filename = storage.save_document(selfie_bytes, selfie.filename or "selfie.jpg")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Selfie: {str(e)}")

    voice_filename = None
    if voice_sample:
        voice_bytes = await voice_sample.read()
        if len(voice_bytes) > 0:
            try:
                voice_filename = storage.save_document(voice_bytes, voice_sample.filename or "voice.webm")
            except ValueError:
                pass

    app = Application(
        email=email or None,
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date_of_birth,
        address=address,
        country=country,
        document_type=document_type,
        document_paths=doc_filenames,
        selfie_path=selfie_filename,
        voice_sample_path=voice_filename,
        status=ApplicationStatus.SUBMITTED.value,
    )
    db.add(app)
    db.flush()

    job = Job(application_id=app.id, status="pending")
    db.add(job)
    db.commit()

    audit.log_event(
        db,
        action="application_submitted",
        actor="applicant",
        application_id=app.id,
        details={"document_type": document_type, "document_count": len(doc_filenames), "has_voice_sample": voice_filename is not None},
    )

    return {"id": app.id, "status": app.status, "message": "Application submitted successfully"}


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    status: str | None = Query(None),
    risk_level: str | None = Query(None),
    search: str | None = Query(None),
    email: str | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Application)

    if email:
        query = query.filter(Application.email == email)
    if status:
        query = query.filter(Application.status == status)
    if risk_level:
        query = query.filter(Application.risk_level == risk_level)
    if search:
        term = f"%{search}%"
        query = query.filter(
            (Application.first_name.ilike(term))
            | (Application.last_name.ilike(term))
            | (Application.id.ilike(term))
        )

    total = query.count()

    sort_col = getattr(Application, sort_by, Application.created_at)
    if sort_order == "asc":
        query = query.order_by(sort_col.asc())
    else:
        query = query.order_by(sort_col.desc())

    offset = (page - 1) * limit
    applications = query.offset(offset).limit(limit).all()

    return ApplicationListResponse(
        applications=[_to_response(a) for a in applications],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/queue", response_model=ApplicationListResponse)
def get_review_queue(
    risk_level: str | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    """Applications pending review, sorted by risk score (highest first)."""
    query = db.query(Application).filter(
        Application.status == ApplicationStatus.PENDING_REVIEW.value
    )
    if risk_level:
        query = query.filter(Application.risk_level == risk_level)

    total = query.count()
    applications = (
        query.order_by(Application.risk_score.desc().nulls_last())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return ApplicationListResponse(
        applications=[_to_response(a) for a in applications],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{application_id}", response_model=ApplicationResponse)
def get_application(application_id: str, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return _to_response(app)


@router.patch("/{application_id}/review")
def review_application(
    application_id: str,
    review: ReviewRequest,
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.status not in (
        ApplicationStatus.PENDING_REVIEW.value,
        ApplicationStatus.PROCESSING_FAILED.value,
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Application in '{app.status}' status cannot be reviewed",
        )

    is_override = False
    if app.risk_level == "high" and review.decision == "approved":
        is_override = True
    elif app.risk_level == "low" and review.decision == "rejected":
        is_override = True

    app.status = review.decision
    app.review_decision = review.decision
    app.review_reason = review.reason
    app.review_notes = review.notes
    app.reviewed_by = review.reviewer
    app.reviewed_at = datetime.now(timezone.utc)
    db.commit()

    audit.log_event(
        db,
        action="application_reviewed",
        actor=review.reviewer,
        application_id=application_id,
        details={
            "decision": review.decision,
            "reason": review.reason,
            "notes": review.notes,
            "is_override": is_override,
            "ai_risk_level": app.risk_level,
            "ai_risk_score": app.risk_score,
        },
    )

    try:
        simulate_outgoing_webhook(db, app, "decision_made")
    except Exception:
        pass

    return {"id": app.id, "status": app.status, "message": "Review submitted"}


@router.get("/{application_id}/voice")
def get_voice_sample(application_id: str, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app or not app.voice_sample_path:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    try:
        path = storage.get_document_path(app.voice_sample_path)
        return FileResponse(path, media_type="audio/webm")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Voice sample not found")


@router.get("/{application_id}/selfie")
def get_selfie(application_id: str, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app or not app.selfie_path:
        raise HTTPException(status_code=404, detail="Selfie not found")
    try:
        path = storage.get_document_path(app.selfie_path)
        return FileResponse(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Selfie not found")


@router.get("/{application_id}/document/{doc_index}")
def get_document(application_id: str, doc_index: int, db: Session = Depends(get_db)):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    paths = app.document_paths or []
    if doc_index < 0 or doc_index >= len(paths):
        raise HTTPException(status_code=404, detail="Document not found")
    try:
        path = storage.get_document_path(paths[doc_index])
        return FileResponse(path)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found")
