import os
import json
import base64
from pathlib import Path
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

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

Return ONLY the JSON object, no additional text."""


def _pdf_to_image_bytes(pdf_path: Path) -> tuple[bytes, str]:
    """Convert the first page of a PDF to a JPEG image for vision analysis."""
    from PIL import Image
    import subprocess
    import tempfile

    with tempfile.TemporaryDirectory() as tmpdir:
        out_path = Path(tmpdir) / "page.jpg"
        try:
            subprocess.run(
                ["sips", "-s", "format", "jpeg", str(pdf_path), "--out", str(out_path)],
                capture_output=True, timeout=15, check=True,
            )
            return out_path.read_bytes(), "image/jpeg"
        except (subprocess.CalledProcessError, FileNotFoundError):
            pass

        img = Image.open(pdf_path)
        img = img.convert("RGB")
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue(), "image/jpeg"


def _prepare_image(doc_path: Path) -> dict:
    """Convert a document path into an OpenAI image_url content block."""
    ext = doc_path.suffix.lower()
    if ext == ".pdf":
        image_bytes, mime_type = _pdf_to_image_bytes(doc_path)
    else:
        image_bytes = doc_path.read_bytes()
        mime_map = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
        mime_type = mime_map.get(ext, "image/jpeg")

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
        content.append(_prepare_image(Path(doc_path)))

    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": content}],
        max_tokens=2000,
        temperature=0.1,
        timeout=30,
    )

    content = response.choices[0].message.content.strip()
    if content.startswith("```"):
        content = content.split("\n", 1)[1]
        if content.endswith("```"):
            content = content[:-3]
        content = content.strip()

    result = json.loads(content)

    required_fields = ["extracted_data", "risk_score", "risk_level", "confidence_score", "flags", "explanation"]
    for field in required_fields:
        if field not in result:
            raise ValueError(f"Missing required field in AI response: {field}")

    if result["confidence_score"] < 0.6:
        result["risk_level"] = "high"

    return result
