import os
import json
import base64
from pathlib import Path
from openai import OpenAI, BadRequestError

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


def _invalid_document_response(reason: str) -> dict:
    """Structured error response for documents that can't be processed at all."""
    return {
        "extracted_data": {"full_name": None, "date_of_birth": None, "document_number": None, "expiry_date": None, "issuing_authority": None},
        "document_quality": {"overall_quality": "poor", "is_blurry": False, "is_cropped": False, "resolution_adequate": False, "issues": [reason]},
        "cross_reference_results": {"name_match": False, "dob_match": False},
        "risk_score": 1.0,
        "risk_level": "high",
        "confidence_score": 0.95,
        "flags": [{"description": reason, "severity": "critical", "field": "document"}],
        "evidence_annotations": [],
        "explanation": f"The uploaded file could not be processed: {reason}. This may indicate a corrupt file, wrong file type, or an intentional evasion attempt.",
    }


ANALYSIS_PROMPT = """You are an expert KYC (Know Your Customer) document analyst for a financial institution.

You are given:
1. One or more identity document images (driver's license, passport, national ID, front/back, supporting documents)
2. Applicant-submitted personal information

Your task is to perform a comprehensive analysis and return a structured JSON response.

## Applicant-Submitted Data
- Name: {first_name} {last_name}
- Date of Birth: {date_of_birth}
- Address: {address}
- Country: {country}
- Document Type: {document_type}

## Instructions

Analyze all provided document images together and return ONLY a valid JSON object with these exact fields:

{{
  "extracted_data": {{
    "full_name": "name as it appears on document",
    "date_of_birth": "YYYY-MM-DD or as shown on document",
    "document_number": "document ID number",
    "expiry_date": "YYYY-MM-DD or null if not visible",
    "issuing_authority": "issuing state/country/authority"
  }},
  "document_quality": {{
    "overall_quality": "good|fair|poor",
    "is_blurry": false,
    "is_cropped": false,
    "resolution_adequate": true,
    "issues": []
  }},
  "cross_reference_results": {{
    "name_match": true,
    "dob_match": true,
    "name_discrepancy": null,
    "dob_discrepancy": null,
    "document_expired": false,
    "other_discrepancies": []
  }},
  "risk_score": 0.15,
  "risk_level": "low",
  "confidence_score": 0.92,
  "flags": [
    {{
      "description": "Description of the flag",
      "severity": "info|warning|critical",
      "field": "optional field name"
    }}
  ],
  "evidence_annotations": [
    {{
      "field": "field name (e.g. full_name, date_of_birth, expiry_date, document_number, photo)",
      "extracted_value": "what you read from the document",
      "submitted_value": "what the applicant provided (or null if not applicable)",
      "location": "where on the document (e.g. 'top-left below photo', 'bottom-right corner', 'header area')",
      "issue_type": "match|mismatch|blur|tampering|quality|expiry|info",
      "severity": "critical|warning|info",
      "description": "Human-readable explanation of this finding"
    }}
  ],
  "explanation": "Plain-English summary of the analysis findings."
}}

## Risk Scoring Guidelines
- risk_score is 0.0 to 1.0 (0 = no risk, 1 = maximum risk)
- risk_level: "low" if risk_score < 0.3, "medium" if 0.3-0.7, "high" if > 0.7
- confidence_score: 0.0 to 1.0 (how confident you are in this analysis)
- If confidence_score < 0.6, set risk_level to "high" regardless of risk_score

## Flag Severity
- "critical": Strong indicators of fraud, tampering, or major discrepancies
- "warning": Minor discrepancies or quality issues that need attention
- "info": Observations that provide context but aren't concerning

## Evidence Annotations
For EVERY field you examine on the document, create an evidence_annotation entry. This enables reviewers to see exactly what was found and where. Include at least entries for: full_name, date_of_birth, document_number, and any fields with discrepancies. The "location" should describe where on the physical document the data appears.

## Non-ID Document Handling
If the uploaded image is NOT a valid government-issued identity document (e.g. it's a random photo, a text document, a screenshot, a meme, a blank page, a receipt, or any non-ID image), you MUST still return the full JSON structure. Set:
- risk_score to 1.0
- risk_level to "high"
- confidence_score to 0.95
- extracted_data fields to null or "N/A"
- Add a critical flag: "Uploaded file is not a valid identity document"
- explanation should describe what the image actually appears to be

ALWAYS return the JSON regardless of what the image contains. Never refuse or return empty.

Return ONLY the JSON object, no additional text."""


def _pdf_to_image_bytes(pdf_path: Path) -> tuple[bytes, str]:
    """Convert the first page of a PDF to a JPEG image for vision analysis."""
    import fitz  # PyMuPDF

    doc = fitz.open(str(pdf_path))
    if len(doc) == 0:
        doc.close()
        raise ValueError("PDF has no pages")
    page = doc[0]
    pix = page.get_pixmap(dpi=200)
    img_bytes = pix.tobytes("jpeg")
    doc.close()
    if not img_bytes:
        raise ValueError("PDF page rendered to empty image")
    return img_bytes, "image/jpeg"


def _prepare_image(doc_path: Path) -> dict:
    """Convert a document path into an OpenAI image_url content block.

    Raises ValueError if the file is missing, empty, or corrupt so the caller
    can fall back to a structured error response instead of crashing.
    """
    if not doc_path.exists():
        raise ValueError(f"File not found: {doc_path}")

    ext = doc_path.suffix.lower()
    try:
        if ext == ".pdf":
            image_bytes, mime_type = _pdf_to_image_bytes(doc_path)
        else:
            image_bytes = doc_path.read_bytes()
            if not image_bytes:
                raise ValueError("File is empty (0 bytes)")
            mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
            mime_type = mime_map.get(ext, "image/jpeg")
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Cannot read file {doc_path.name}: {e}")

    base64_image = base64.b64encode(image_bytes).decode("utf-8")
    return {
        "type": "image_url",
        "image_url": {
            "url": f"data:{mime_type};base64,{base64_image}",
            "detail": "high",
        },
    }


def analyze_document(
    document_paths: list[str],
    first_name: str,
    last_name: str,
    date_of_birth: str,
    address: str,
    country: str,
    document_type: str,
) -> dict:
    content: list[dict] = []

    prompt = ANALYSIS_PROMPT.format(
        first_name=first_name,
        last_name=last_name,
        date_of_birth=date_of_birth,
        address=address,
        country=country,
        document_type=document_type,
    )
    content.append({"type": "text", "text": prompt})

    for i, doc_path in enumerate(document_paths):
        content.append({"type": "text", "text": f"Document {i + 1} of {len(document_paths)}:"})
        try:
            content.append(_prepare_image(Path(doc_path)))
        except ValueError as img_err:
            return _invalid_document_response(f"Document {i + 1} could not be loaded: {img_err}")

    import time as _time

    last_error = None
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": content}],
                max_tokens=2000,
                temperature=0.1,
                timeout=45,
            )

            raw = (response.choices[0].message.content or "").strip()
            if not raw:
                raise ValueError(f"Empty response from GPT-4o (attempt {attempt + 1})")

            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1]
                if raw.endswith("```"):
                    raw = raw[:-3]
                raw = raw.strip()

            result = json.loads(raw)

            required_fields = ["extracted_data", "risk_score", "risk_level", "confidence_score", "flags", "explanation"]
            for field in required_fields:
                if field not in result:
                    raise ValueError(f"Missing required field in AI response: {field}")

            if result["confidence_score"] < 0.6:
                result["risk_level"] = "high"

            return result
        except BadRequestError as e:
            return _invalid_document_response(f"Not a valid image format: {e}")
        except (json.JSONDecodeError, ValueError, AttributeError) as e:
            last_error = e
            if attempt < 2:
                _time.sleep(1)
                continue
            raise

    raise last_error  # type: ignore[misc]
