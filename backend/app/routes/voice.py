from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.application import Application
from app.services import storage
from app.services.voice_analyzer import compare_voices
from app.services import audit

router = APIRouter(prefix="/api/voice", tags=["voice"])


@router.post("/reverify")
async def voice_reverify(
    email: str = Form(...),
    voice_sample: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Compare a new voice recording against the enrolled baseline for this email."""
    enrollment_app = (
        db.query(Application)
        .filter(
            Application.email == email,
            Application.voice_sample_path.isnot(None),
        )
        .order_by(Application.created_at.asc())
        .first()
    )

    if not enrollment_app:
        raise HTTPException(
            status_code=404,
            detail="No enrolled voice sample found for this email. Submit an application with a voice recording first.",
        )

    voice_bytes = await voice_sample.read()
    if len(voice_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty voice recording")

    try:
        new_filename = storage.save_document(voice_bytes, voice_sample.filename or "reverify.webm")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    enrollment_path = str(storage.get_document_path(enrollment_app.voice_sample_path))
    new_path = str(storage.get_document_path(new_filename))

    try:
        result = compare_voices(
            enrollment_audio_path=enrollment_path,
            new_audio_path=new_path,
            first_name=enrollment_app.first_name,
            last_name=enrollment_app.last_name,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Voice comparison failed: {str(e)}")

    audit.log_event(
        db,
        action="voice_reverification",
        actor=email,
        application_id=enrollment_app.id,
        details={
            "match_result": result.get("match_result"),
            "same_speaker_likelihood": result.get("same_speaker_likelihood"),
            "confidence": result.get("confidence"),
        },
    )

    return {
        "match_result": result.get("match_result"),
        "same_speaker_likelihood": result.get("same_speaker_likelihood"),
        "confidence": result.get("confidence"),
        "passphrase_consistency": result.get("passphrase_consistency"),
        "name_spoken_in_new": result.get("name_spoken_in_new"),
        "speech_pattern_notes": result.get("speech_pattern_notes"),
        "anomalies": result.get("anomalies", []),
        "explanation": result.get("explanation"),
        "enrollment_application_id": enrollment_app.id,
        "enrollment_name": f"{enrollment_app.first_name} {enrollment_app.last_name}",
    }


@router.get("/enrolled/{email}")
def get_enrollment_status(email: str, db: Session = Depends(get_db)):
    """Check if this email has an enrolled voice sample."""
    enrollment_app = (
        db.query(Application)
        .filter(
            Application.email == email,
            Application.voice_sample_path.isnot(None),
        )
        .order_by(Application.created_at.asc())
        .first()
    )

    if not enrollment_app:
        return {"enrolled": False}

    return {
        "enrolled": True,
        "application_id": enrollment_app.id,
        "enrolled_name": f"{enrollment_app.first_name} {enrollment_app.last_name}",
        "enrolled_at": enrollment_app.created_at.isoformat(),
    }
