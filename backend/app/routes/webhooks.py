from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.application import Application, Job, WebhookLog
from app.services import audit
from app.services.webhooks import (
    load_webhook_config,
    save_webhook_config,
    verify_signature,
    simulate_outgoing_webhook,
)

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


# --- Schemas ---

class WSApplicant(BaseModel):
    email: str
    first_name: str
    last_name: str
    date_of_birth: str
    address: str = ""
    country: str = "Canada"

class WSDocument(BaseModel):
    type: str  # drivers_license, passport, national_id
    document_url: Optional[str] = None

class WSIncomingPayload(BaseModel):
    """Simulates a Wealthsimple webhook payload for a failed auto-verification."""
    event: str = "verification_failed"
    client_id: Optional[str] = None
    applicant: WSApplicant
    document: WSDocument
    failure_reason: str = "auto_verification_failed"
    failure_details: Optional[str] = None
    priority: str = "normal"  # normal / high / urgent


# --- Incoming webhook ---

@router.post("/incoming")
async def receive_incoming_webhook(
    payload: WSIncomingPayload,
    request: Request,
    db: Session = Depends(get_db),
    x_ws_signature: Optional[str] = Header(None),
):
    """
    Receive an incoming webhook from Wealthsimple.
    Creates a new KYC review application from the payload.
    """
    config = load_webhook_config()

    if x_ws_signature:
        body = await request.body()
        if not verify_signature(body.decode(), x_ws_signature, config["secret"]):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    app = Application(
        email=payload.applicant.email,
        first_name=payload.applicant.first_name,
        last_name=payload.applicant.last_name,
        date_of_birth=payload.applicant.date_of_birth,
        address=payload.applicant.address,
        country=payload.applicant.country,
        document_type=payload.document.type,
        document_paths=[],
    )
    db.add(app)
    db.flush()

    job = Job(application_id=app.id)
    db.add(job)

    log = WebhookLog(
        direction="incoming",
        event_type=payload.event,
        application_id=app.id,
        payload=payload.model_dump(),
        status="success",
        status_code=200,
    )
    db.add(log)

    audit.log_event(
        db,
        action="webhook_incoming",
        actor="wealthsimple",
        application_id=app.id,
        details={
            "event": payload.event,
            "client_id": payload.client_id,
            "failure_reason": payload.failure_reason,
            "priority": payload.priority,
        },
    )

    db.commit()

    return {
        "received": True,
        "kyc_review_id": app.id,
        "status": "queued_for_review",
        "message": f"Application created for {payload.applicant.first_name} {payload.applicant.last_name}",
    }


# --- Simulate incoming (for demo) ---

DEMO_PAYLOADS = [
    WSIncomingPayload(
        event="verification_failed",
        client_id="ws-client-001",
        applicant=WSApplicant(
            email="sarah.chen@example.com",
            first_name="Sarah",
            last_name="Chen",
            date_of_birth="1992-03-15",
            address="456 Spadina Ave, Toronto ON M5T 2G7",
            country="Canada",
        ),
        document=WSDocument(type="passport"),
        failure_reason="selfie_mismatch",
        failure_details="Persona auto-verification failed: selfie does not match ID photo with sufficient confidence.",
        priority="normal",
    ),
    WSIncomingPayload(
        event="verification_failed",
        client_id="ws-client-002",
        applicant=WSApplicant(
            email="dmitri.volkov@example.com",
            first_name="Dmitri",
            last_name="Volkov",
            date_of_birth="1985-11-22",
            address="789 International Blvd, Vancouver BC V6B 1E8",
            country="Russia",
        ),
        document=WSDocument(type="national_id"),
        failure_reason="high_risk_jurisdiction",
        failure_details="Applicant from FATF grey-list country. Requires enhanced due diligence.",
        priority="high",
    ),
    WSIncomingPayload(
        event="verification_failed",
        client_id="ws-client-003",
        applicant=WSApplicant(
            email="aisha.mohammed@example.com",
            first_name="Aisha",
            last_name="Mohammed",
            date_of_birth="1998-07-04",
            address="321 Bank St, Ottawa ON K2P 1Y3",
            country="Canada",
        ),
        document=WSDocument(type="drivers_license"),
        failure_reason="document_quality",
        failure_details="Uploaded document is blurry and partially cropped. OCR extraction unreliable.",
        priority="normal",
    ),
]


@router.post("/simulate-incoming")
def simulate_incoming_webhook(
    scenario_index: int = 0,
    db: Session = Depends(get_db),
):
    """Fire a simulated incoming webhook using a built-in demo scenario."""
    if scenario_index < 0 or scenario_index >= len(DEMO_PAYLOADS):
        scenario_index = 0

    payload = DEMO_PAYLOADS[scenario_index]

    app = Application(
        email=payload.applicant.email,
        first_name=payload.applicant.first_name,
        last_name=payload.applicant.last_name,
        date_of_birth=payload.applicant.date_of_birth,
        address=payload.applicant.address,
        country=payload.applicant.country,
        document_type=payload.document.type,
        document_paths=[],
    )
    db.add(app)
    db.flush()

    job = Job(application_id=app.id)
    db.add(job)

    log = WebhookLog(
        direction="incoming",
        event_type=payload.event,
        application_id=app.id,
        payload=payload.model_dump(),
        status="success",
        status_code=200,
    )
    db.add(log)

    audit.log_event(
        db,
        action="webhook_incoming_simulated",
        actor="demo",
        application_id=app.id,
        details={
            "scenario": scenario_index,
            "event": payload.event,
            "failure_reason": payload.failure_reason,
        },
    )

    db.commit()

    return {
        "received": True,
        "kyc_review_id": app.id,
        "simulated": True,
        "scenario": {
            "client_id": payload.client_id,
            "name": f"{payload.applicant.first_name} {payload.applicant.last_name}",
            "failure_reason": payload.failure_reason,
            "failure_details": payload.failure_details,
            "priority": payload.priority,
        },
    }


# --- Simulate outgoing callback ---

@router.post("/simulate-outgoing/{application_id}")
def simulate_outgoing(application_id: str, db: Session = Depends(get_db)):
    """Simulate sending a decision callback to Wealthsimple for a reviewed application."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if not app.review_decision:
        raise HTTPException(status_code=400, detail="Application has not been reviewed yet")

    log = simulate_outgoing_webhook(db, app, "decision_made")

    return {
        "sent": True,
        "webhook_log_id": log.id,
        "event": "decision_made",
        "callback_url": load_webhook_config()["callback_url"],
        "payload": log.payload,
        "response": log.response_body,
    }


# --- Webhook log ---

@router.get("/logs")
def get_webhook_logs(
    direction: Optional[str] = None,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    query = db.query(WebhookLog).order_by(WebhookLog.created_at.desc())
    if direction in ("incoming", "outgoing"):
        query = query.filter(WebhookLog.direction == direction)
    logs = query.limit(limit).all()

    return {
        "logs": [
            {
                "id": l.id,
                "created_at": l.created_at.isoformat(),
                "direction": l.direction,
                "event_type": l.event_type,
                "application_id": l.application_id,
                "status": l.status,
                "status_code": l.status_code,
                "payload": l.payload,
                "response_body": l.response_body,
                "error": l.error,
            }
            for l in logs
        ],
        "total": len(logs),
    }


# --- Webhook config ---

@router.get("/config")
def get_webhook_config():
    return load_webhook_config()


class WebhookConfigUpdate(BaseModel):
    enabled: Optional[bool] = None
    callback_url: Optional[str] = None
    secret: Optional[str] = None
    retry_count: Optional[int] = None
    timeout_seconds: Optional[int] = None
    events: Optional[dict] = None


@router.put("/config")
def update_webhook_config(body: WebhookConfigUpdate):
    config = load_webhook_config()
    update_data = body.model_dump(exclude_none=True)
    if "events" in update_data:
        config["events"] = {**config.get("events", {}), **update_data.pop("events")}
    config.update(update_data)
    return save_webhook_config(config)


# --- Available demo scenarios ---

@router.get("/scenarios")
def list_scenarios():
    return {
        "scenarios": [
            {
                "index": i,
                "client_id": p.client_id,
                "name": f"{p.applicant.first_name} {p.applicant.last_name}",
                "country": p.applicant.country,
                "document_type": p.document.type,
                "failure_reason": p.failure_reason,
                "failure_details": p.failure_details,
                "priority": p.priority,
            }
            for i, p in enumerate(DEMO_PAYLOADS)
        ]
    }
