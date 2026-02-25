"""
Mock Wealthsimple webhook integration.

Simulates:
- Incoming webhooks: Wealthsimple sends us failed-verification applicants
- Outgoing webhooks: We send decisions back to Wealthsimple
- HMAC signature verification for security
"""

import hashlib
import hmac
import json
import os
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

import requests
from sqlalchemy.orm import Session

from app.models.application import WebhookLog

CONFIG_PATH = Path(__file__).parent.parent.parent / "webhook_config.json"
_lock = threading.Lock()

DEFAULT_CONFIG = {
    "enabled": False,
    "callback_url": "https://api.wealthsimple.mock/kyc/decisions",
    "secret": "ws_webhook_secret_demo_key",
    "retry_count": 3,
    "timeout_seconds": 10,
    "events": {
        "decision_made": True,
        "processing_complete": True,
        "high_risk_flagged": True,
    },
}


def load_webhook_config() -> dict:
    with _lock:
        if CONFIG_PATH.exists():
            try:
                stored = json.loads(CONFIG_PATH.read_text())
                merged = {**DEFAULT_CONFIG, **stored}
                merged["events"] = {**DEFAULT_CONFIG["events"], **stored.get("events", {})}
                return merged
            except (json.JSONDecodeError, OSError):
                pass
        return dict(DEFAULT_CONFIG)


def save_webhook_config(config: dict) -> dict:
    with _lock:
        CONFIG_PATH.write_text(json.dumps(config, indent=2))
    return config


def generate_signature(payload: str, secret: str) -> str:
    return "sha256=" + hmac.new(
        secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()


def verify_signature(payload: str, signature: str, secret: str) -> bool:
    expected = generate_signature(payload, secret)
    return hmac.compare_digest(expected, signature)


def _build_decision_payload(app, event_type: str) -> dict:
    """Build a Wealthsimple-style webhook payload from our application."""
    return {
        "event": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "data": {
            "kyc_review_id": app.id,
            "client": {
                "email": app.email,
                "first_name": app.first_name,
                "last_name": app.last_name,
                "date_of_birth": app.date_of_birth,
                "country": app.country,
            },
            "document_type": app.document_type,
            "decision": {
                "status": app.status,
                "review_decision": app.review_decision,
                "review_reason": app.review_reason,
                "review_notes": app.review_notes,
                "reviewed_by": app.reviewed_by,
                "reviewed_at": app.reviewed_at.isoformat() if app.reviewed_at else None,
            },
            "risk_assessment": {
                "risk_score": app.risk_score,
                "risk_level": app.risk_level,
                "confidence_score": app.confidence_score,
                "flags": app.flags or [],
                "regulatory_priority": app.regulatory_priority,
            },
            "biometrics": {
                "facial_match": app.facial_match.get("match_result") if app.facial_match else None,
                "voice_verification": app.voice_verification.get("verification_result") if app.voice_verification else None,
            },
        },
    }


def fire_outgoing_webhook(db: Session, app, event_type: str) -> WebhookLog | None:
    """Fire an outgoing webhook to the configured callback URL."""
    config = load_webhook_config()

    if not config.get("enabled"):
        return None

    events = config.get("events", {})
    if not events.get(event_type, False):
        return None

    payload = _build_decision_payload(app, event_type)
    payload_json = json.dumps(payload)
    signature = generate_signature(payload_json, config["secret"])

    log = WebhookLog(
        direction="outgoing",
        event_type=event_type,
        application_id=app.id,
        payload=payload,
        status="pending",
    )
    db.add(log)
    db.commit()

    callback_url = config["callback_url"]
    timeout = config.get("timeout_seconds", 10)
    retries = config.get("retry_count", 3)

    for attempt in range(retries):
        try:
            resp = requests.post(
                callback_url,
                data=payload_json,
                headers={
                    "Content-Type": "application/json",
                    "X-WS-Signature": signature,
                    "X-WS-Event": event_type,
                    "User-Agent": "KYC-Risk-Reviewer/1.0",
                },
                timeout=timeout,
            )
            log.status_code = resp.status_code
            log.response_body = resp.text[:2000]
            if resp.ok:
                log.status = "success"
                db.commit()
                return log
            else:
                log.error = f"HTTP {resp.status_code}: {resp.text[:500]}"
        except requests.RequestException as e:
            log.error = f"Attempt {attempt + 1}/{retries}: {str(e)}"

        if attempt < retries - 1:
            time.sleep(1 * (attempt + 1))

    log.status = "failed"
    db.commit()
    return log


def simulate_outgoing_webhook(db: Session, app, event_type: str) -> WebhookLog:
    """Simulate firing an outgoing webhook (no actual HTTP, always succeeds)."""
    config = load_webhook_config()
    payload = _build_decision_payload(app, event_type)

    log = WebhookLog(
        direction="outgoing",
        event_type=event_type,
        application_id=app.id,
        payload=payload,
        status="success",
        status_code=200,
        response_body=json.dumps({
            "received": True,
            "kyc_review_id": app.id,
            "wealthsimple_client_id": f"ws-client-{app.id[:8]}",
            "message": f"Decision '{app.review_decision}' recorded for {app.first_name} {app.last_name}",
        }),
    )
    db.add(log)
    db.commit()
    return log
