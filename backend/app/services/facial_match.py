"""
Facial comparison using GPT-4o vision.
Compares the selfie photo with the photo on the identity document.
"""

import os
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

Return ONLY the JSON object."""


def _prepare_image(path: Path) -> dict:
    ext = path.suffix.lower()
    if ext == ".pdf":
        import fitz  # PyMuPDF
        doc = fitz.open(str(path))
        page = doc[0]
        pix = page.get_pixmap(dpi=200)
        image_bytes = pix.tobytes("jpeg")
        doc.close()
        mime_type = "image/jpeg"
    else:
        image_bytes = path.read_bytes()
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
        mime_type = mime_map.get(ext, "image/jpeg")
    b64 = base64.b64encode(image_bytes).decode("utf-8")
    return {
        "type": "image_url",
        "image_url": {"url": f"data:{mime_type};base64,{b64}", "detail": "high"},
    }


def compare_faces(
    document_path: str,
    selfie_path: str,
) -> dict:
    """Compare the face on an ID document with a selfie using GPT-4o vision."""
    doc_path = Path(document_path)
    sel_path = Path(selfie_path)

    if not doc_path.exists():
        raise FileNotFoundError(f"Document not found: {document_path}")
    if not sel_path.exists():
        raise FileNotFoundError(f"Selfie not found: {selfie_path}")

    content: list[dict] = [
        {"type": "text", "text": FACIAL_MATCH_PROMPT},
        {"type": "text", "text": "Image 1 — Identity Document:"},
        _prepare_image(doc_path),
        {"type": "text", "text": "Image 2 — Applicant Selfie:"},
        _prepare_image(sel_path),
    ]

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=1500,
        temperature=0.1,
        timeout=30,
    )

    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1]
        if raw.endswith("```"):
            raw = raw[:-3]
        raw = raw.strip()

    result = json.loads(raw)
    return result
