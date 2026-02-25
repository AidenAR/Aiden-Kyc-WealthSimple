"""
Standalone worker process that polls the job queue and runs AI document analysis.

Usage: python worker.py
"""

import sys
import time
import signal
import traceback
from datetime import datetime, timezone, timedelta
from pathlib import Path

from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, str(Path(__file__).parent))

from app.database import SessionLocal, init_db
from app.models.application import Application, Job, ApplicationStatus
from app.services.analyzer import analyze_document
from app.services.facial_match import compare_faces
from app.services.regulatory import screen_application
from app.services.screening_config import load_config
from app.services.storage import get_document_path
from app.services import audit

POLL_INTERVAL = 2
LOCK_TIMEOUT = 60
MAX_RETRIES = 3
JOB_TIMEOUT = 30

_running = True


def _signal_handler(sig, frame):
    global _running
    print("\n[Worker] Shutting down gracefully...")
    _running = False


signal.signal(signal.SIGINT, _signal_handler)
signal.signal(signal.SIGTERM, _signal_handler)


def claim_job(db) -> Job | None:
    """Atomically claim the next available job."""
    now = datetime.now(timezone.utc)
    stale_threshold = now - timedelta(seconds=LOCK_TIMEOUT)

    job = (
        db.query(Job)
        .filter(
            Job.status == "pending",
            (Job.locked_at.is_(None)) | (Job.locked_at < stale_threshold),
            (Job.next_retry_at.is_(None)) | (Job.next_retry_at <= now),
        )
        .order_by(Job.created_at.asc())
        .with_for_update(skip_locked=True)
        .first()
    )

    if job:
        job.locked_at = now
        job.status = "processing"
        db.commit()

    return job


def _try_auto_approve(app: Application, reg: dict, ai_result: dict) -> bool:
    """Check if this application qualifies for automatic approval.

    Auto-approval is only for clear-cut low-risk cases. Rejections ALWAYS
    require human review — denying someone financial services demands
    human accountability.
    """
    cfg = load_config().get("auto_approve", {})
    if not cfg.get("enabled", False):
        return False

    score = reg.get("adjusted_risk_score", 1.0)
    level = reg.get("adjusted_risk_level", "high")
    confidence = app.confidence_score or 0.0

    if level != "low" or score > cfg.get("max_risk_score", 0.3):
        return False

    if confidence < cfg.get("min_confidence", 0.85):
        return False

    if cfg.get("block_on_critical_flags", True):
        for flag in (ai_result.get("flags") or []):
            if isinstance(flag, dict) and flag.get("severity") == "critical":
                return False
        for rf in (reg.get("regulatory_flags") or []):
            if isinstance(rf, dict) and rf.get("severity") == "critical":
                return False

    if cfg.get("require_facial_match", True):
        fm = app.facial_match or {}
        if fm.get("match_result") != "match":
            return False
        if (fm.get("similarity_score") or 0) < cfg.get("min_facial_similarity", 0.7):
            return False

    app.status = ApplicationStatus.APPROVED.value
    app.review_decision = "approved"
    app.review_reason = "Auto-approved by AI"
    app.reviewed_by = "ai_auto_approve"
    app.reviewed_at = datetime.now(timezone.utc)
    app.review_notes = (
        f"Automatically approved — risk score {score:.2f} (low), "
        f"confidence {confidence:.0%}, facial match confirmed. "
        f"No critical flags detected."
    )
    return True


def process_job(db, job: Job):
    """Process a single job: run AI analysis and update the application."""
    app = db.query(Application).filter(Application.id == job.application_id).first()
    if not app:
        job.status = "failed"
        job.error = "Application not found"
        db.commit()
        return

    app.status = ApplicationStatus.PROCESSING.value
    db.commit()

    try:
        doc_paths = []
        for p in (app.document_paths or []):
            try:
                doc_paths.append(str(get_document_path(p)))
            except FileNotFoundError:
                print(f"[Worker] Warning: document file missing: {p}")

        if not doc_paths:
            raise ValueError("No documents found for this application")

        result = analyze_document(
            document_paths=doc_paths,
            first_name=app.first_name or "",
            last_name=app.last_name or "",
            date_of_birth=app.date_of_birth or "",
            address=app.address or "",
            country=app.country or "",
            document_type=app.document_type or "",
        )

        try:
            app.confidence_score = float(result.get("confidence_score", 0))
        except (TypeError, ValueError):
            app.confidence_score = 0.0
        app.ai_explanation = str(result.get("explanation", "")) or None
        app.extracted_data = result.get("extracted_data")
        app.flags = result.get("flags")
        app.cross_reference_results = result.get("cross_reference_results")
        app.document_quality = result.get("document_quality")
        app.evidence_annotations = result.get("evidence_annotations")

        # Facial comparison (selfie vs document photo)
        if app.selfie_path and doc_paths:
            try:
                selfie_full = str(get_document_path(app.selfie_path))
                face_result = compare_faces(
                    document_path=doc_paths[0],
                    selfie_path=selfie_full,
                )
                app.facial_match = face_result
                match_status = face_result.get("match_result", "unknown")
                similarity = face_result.get("similarity_score", 0)
                print(f"[Worker] Facial match: {match_status} (similarity={similarity:.0%})")
            except Exception as fe:
                print(f"[Worker] Facial comparison failed (non-fatal): {fe}")
                app.facial_match = {
                    "match_result": "error",
                    "similarity_score": 0.0,
                    "confidence": 0.0,
                    "document_photo_quality": "unknown",
                    "selfie_quality": "unknown",
                    "face_detected_in_document": False,
                    "face_detected_in_selfie": False,
                    "explanation": f"Facial comparison failed: {str(fe)}",
                    "anomalies": [],
                    "key_observations": [],
                }

        # Voice sample saved for future re-verification (no analysis at submission)
        if app.voice_sample_path:
            app.voice_verification = {
                "verification_result": "enrolled",
                "explanation": "Voice sample enrolled as baseline for future re-verification.",
                "anomalies": [],
            }
            print(f"[Worker] Voice sample enrolled for {app.email or app.id}")

        try:
            risk_score = float(result.get("risk_score", 0.5))
        except (TypeError, ValueError):
            risk_score = 0.5

        reg = screen_application(
            country=app.country or "",
            risk_score=risk_score,
            risk_level=result.get("risk_level", "medium"),
            confidence_score=app.confidence_score or 0.0,
            cross_reference_results=result.get("cross_reference_results"),
            document_quality=result.get("document_quality"),
            flags=result.get("flags"),
            first_name=app.first_name or "",
            last_name=app.last_name or "",
        )

        app.risk_score = reg["adjusted_risk_score"]
        app.risk_level = reg["adjusted_risk_level"]
        app.regulatory_flags = reg["regulatory_flags"]
        app.regulatory_priority = reg["priority"]

        auto_approved = _try_auto_approve(app, reg, result)
        if not auto_approved:
            app.status = ApplicationStatus.PENDING_REVIEW.value

        job.status = "completed"
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        reg_count = len(reg.get("regulatory_flags", []))
        audit.log_event(
            db,
            action="ai_analysis_completed",
            actor="ai_system",
            application_id=app.id,
            details={
                "ai_risk_score": risk_score,
                "ai_risk_level": result.get("risk_level", "unknown"),
                "final_risk_score": reg["adjusted_risk_score"],
                "final_risk_level": reg["adjusted_risk_level"],
                "confidence_score": app.confidence_score,
                "flag_count": len(result.get("flags") or []),
                "regulatory_flags": reg_count,
                "regulatory_priority": reg.get("priority", "standard"),
                "auto_approved": auto_approved,
            },
        )

        if auto_approved:
            audit.log_event(
                db,
                action="auto_approved",
                actor="ai_system",
                application_id=app.id,
                details={
                    "risk_score": reg["adjusted_risk_score"],
                    "risk_level": reg["adjusted_risk_level"],
                    "confidence_score": app.confidence_score,
                    "facial_similarity": (app.facial_match or {}).get("similarity_score"),
                    "reason": "All auto-approval criteria met — low risk, high confidence, no critical flags",
                },
            )
            db.commit()

        adj_note = ""
        for a in reg.get("adjustments_applied") or []:
            factor = a.get("factor", "unknown") if isinstance(a, dict) else str(a)
            adj_note += f", {factor}"
        if adj_note:
            adj_note = f" | regulatory adjustments: {adj_note[2:]}"

        status_label = "AUTO-APPROVED" if auto_approved else reg.get("priority", "standard")
        print(f"[Worker] Completed: {app.id} | risk={reg['adjusted_risk_level']} score={reg['adjusted_risk_score']:.2f} confidence={app.confidence_score:.2f} priority={status_label}{adj_note}")

    except Exception as e:
        error_msg = f"{type(e).__name__}: {str(e)}"
        print(f"[Worker] Failed: {app.id} | {error_msg}")
        traceback.print_exc()

        job.retry_count += 1
        app.retry_count = job.retry_count
        app.processing_error = error_msg

        if job.retry_count < MAX_RETRIES:
            backoff = 2 ** job.retry_count
            job.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
            job.status = "pending"
            job.locked_at = None
            app.status = ApplicationStatus.PROCESSING_FAILED.value
            print(f"[Worker] Retrying in {backoff}s (attempt {job.retry_count}/{MAX_RETRIES})")
        else:
            job.status = "failed"
            app.status = ApplicationStatus.PROCESSING_FAILED.value
            print(f"[Worker] Max retries exceeded for {app.id}")
            audit.log_event(
                db,
                action="processing_failed",
                actor="ai_system",
                application_id=app.id,
                details={"error": error_msg, "retry_count": job.retry_count},
            )

        db.commit()


def run():
    print("[Worker] Starting KYC processing worker...")
    print(f"[Worker] Poll interval: {POLL_INTERVAL}s | Lock timeout: {LOCK_TIMEOUT}s | Max retries: {MAX_RETRIES}")
    init_db()

    while _running:
        db = SessionLocal()
        try:
            job = claim_job(db)
            if job:
                print(f"[Worker] Claimed job {job.id} for application {job.application_id}")
                process_job(db, job)
            else:
                time.sleep(POLL_INTERVAL)
        except Exception as e:
            print(f"[Worker] Error: {e}")
            traceback.print_exc()
            time.sleep(POLL_INTERVAL)
        finally:
            db.close()

    print("[Worker] Stopped.")


if __name__ == "__main__":
    run()
