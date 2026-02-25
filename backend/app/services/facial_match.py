"""
Facial comparison using GPT-4o vision.
Compares the selfie photo with the photo on the identity document.
"""

import os
from openai import BadRequestError
import json
import base64
from pathlib import Path
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

FACIAL_MATCH_PROMPT = """You are a facial recognition analyst for a KYC (Know Your Customer) identity verification system.

You are given TWO images:
1. **Identity Document** — a government-issued ID (passport, driver's license, national ID) that contains a photo of the holder.
2. **Live Selfie** — a photo the applicant just took of themselves.

Your task is to compare the face on the identity document with the face in the selfie and determine if they are the SAME person.

Return ONLY a valid JSON object:

{{
  "match_result": "match|mismatch|inconclusive",
  "confidence": 0.0-1.0,
  "similarity_score": 0.0-1.0,
  "document_photo_quality": "good|fair|poor",
  "selfie_quality": "good|fair|poor",
  "face_detected_in_document": true/false,
  "face_detected_in_selfie": true/false,
  "key_observations": [
    {{
      "feature": "feature name (e.g. face_shape, eyes, nose, skin_tone, hair, age_consistency)",
      "assessment": "match|possible_match|mismatch|unclear",
      "note": "brief explanation"
    }}
  ],
  "anomalies": [
    {{
      "type": "photo_substitution|lighting_difference|age_difference|quality_issue|possible_mask|no_face",
      "severity": "critical|warning|info",
      "description": "explanation"
    }}
  ],
  "explanation": "Plain-English summary of the facial comparison"
}}

## Guidelines
- similarity_score: 1.0 = clearly same person, 0.0 = clearly different people
- "match" if similarity > 0.7 and you're confident it's the same person
- "mismatch" if similarity < 0.4 or you're confident it's a different person
- "inconclusive" if quality prevents reliable comparison
- Focus on: face shape, eye spacing, nose structure, jawline, skin tone, hair consistency, apparent age
- Note if the document photo looks artificially swapped or tampered with
- Note significant differences in apparent age between document photo and selfie
- If the document image is NOT a valid ID or contains no face, set match_result to "mismatch", similarity_score to 0.0, face_detected_in_document to false, and add an anomaly explaining the issue

ALWAYS return the full JSON structure regardless of image content. Never refuse or return empty.

Return ONLY the JSON object."""


def _facial_error_response(reason: str) -> dict:
    return {
        "match_result": "error",
        "similarity_score": 0.0,
        "confidence": 0.0,
        "document_photo_quality": "unknown",
        "selfie_quality": "unknown",
        "face_detected_in_document": False,
        "face_detected_in_selfie": False,
        "explanation": reason,
        "anomalies": [{"type": "invalid_image", "severity": "critical", "description": reason}],
        "key_observations": [],
    }


def _parse_json_object(raw: str) -> dict:
    raw = (raw or "").strip()
    if not raw:
        raise ValueError("Empty model response")

    # Strip markdown fences if present
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else ""
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    # First attempt: strict parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Fallback: extract the first JSON object in the text
        start = raw.find("{")
        end = raw.rfind("}")
        if start != -1 and end != -1 and end > start:
            candidate = raw[start : end + 1]
            return json.loads(candidate)
        raise


def _prepare_image(path: Path) -> dict:
    """Convert a file into an OpenAI image_url block. Raises ValueError on corrupt/missing/empty files."""
    if not path.exists():
        raise ValueError(f"File not found: {path}")

    ext = path.suffix.lower()
    try:
        if ext == ".pdf":
            import fitz  # PyMuPDF
            doc = fitz.open(str(path))
            if len(doc) == 0:
                doc.close()
                raise ValueError("PDF has no pages")
            page = doc[0]
            pix = page.get_pixmap(dpi=200)
            image_bytes = pix.tobytes("jpeg")
            doc.close()
            if not image_bytes:
                raise ValueError("PDF page rendered to empty image")
            mime_type = "image/jpeg"
        else:
            image_bytes = path.read_bytes()
            if not image_bytes:
                raise ValueError("File is empty (0 bytes)")
            mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
            mime_type = mime_map.get(ext, "image/jpeg")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Cannot read file {path.name}: {e}")

    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{b64}", "detail": "high"},
    }


def compare_faces(
    document_path: str,
    selfie_path: str,
) -> dict:
    """Compare the face on an ID document with a selfie using GPT-4o vision.

    This function NEVER raises — it always returns a dict (either a real
    result or a structured error response).
    """
    try:
        return _compare_faces_inner(document_path, selfie_path)
    except Exception as e:
        return _facial_error_response(f"Unexpected error: {e}")


def _compare_faces_inner(document_path: str, selfie_path: str) -> dict:
    doc_path = Path(document_path)
    sel_path = Path(selfie_path)

    if not doc_path.exists():
        return _facial_error_response(f"Document not found: {document_path}")
    if not sel_path.exists():
        return _facial_error_response(f"Selfie not found: {selfie_path}")

    try:
        doc_image = _prepare_image(doc_path)
    except ValueError as e:
        return _facial_error_response(f"Document image could not be loaded: {e}")
    try:
        sel_image = _prepare_image(sel_path)
    except ValueError as e:
        return _facial_error_response(f"Selfie image could not be loaded: {e}")

    content: list[dict] = [
        {"type": "text", "text": FACIAL_MATCH_PROMPT},
        {"type": "text", "text": "Image 1 — Identity Document:"},
        doc_image,
        {"type": "text", "text": "Image 2 — Applicant Selfie:"},
        sel_image,
    ]

    last_error = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": content}],
                max_tokens=1500,
                temperature=0.1,
                timeout=45,
                response_format={"type": "json_object"},
            )

            raw = (response.choices[0].message.content or "").strip()
            if not raw:
                raise ValueError(f"Empty response from GPT-4o (attempt {attempt + 1})")

            return _parse_json_object(raw)
        except BadRequestError as e:
            return _facial_error_response(f"OpenAI rejected the image: {e}")
        except Exception as e:
            last_error = e
            if attempt < 2:
                import time
                time.sleep(1)
                continue
            return _facial_error_response(f"Facial comparison failed: {e}")

    return _facial_error_response(f"Facial comparison failed: {last_error}")
