"""Adversarial testing mode: pre-built fraud scenarios with simulated AI results."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.application import Application, ApplicationStatus
from app.schemas.application import AdversarialScenario, AdversarialTestResponse
from app.services import audit
from app.services.regulatory import screen_application

router = APIRouter(prefix="/api/demo", tags=["demo"])

SCENARIOS: dict[str, dict] = {
    "photoshopped_expiry": {
        "scenario": AdversarialScenario(
            id="photoshopped_expiry",
            name="Photoshopped Expiry Date",
            description="An expired driver's license where the expiry date has been digitally altered. "
                        "The AI detects font inconsistency and JPEG artifact patterns around the date field.",
            attack_type="Document Tampering",
            expected_outcome="HIGH risk — critical flag for suspected digital alteration",
        ),
        "applicant": {
            "email": "marcus.belmont@example.com",
            "first_name": "Marcus",
            "last_name": "Belmont",
            "date_of_birth": "1985-03-14",
            "address": "742 Evergreen Terrace, Toronto, ON M4B 1B3",
            "country": "Canada",
            "document_type": "drivers_license",
        },
        "analysis": {
            "risk_score": 0.88,
            "risk_level": "high",
            "confidence_score": 0.91,
            "ai_explanation": (
                "High-confidence detection of document tampering. The expiry date field shows "
                "inconsistent font rendering and compression artifacts that differ from surrounding text, "
                "strongly suggesting digital alteration. The original expiry appears to have been 2023-01-15 "
                "(expired), modified to read 2027-01-15. All other extracted fields match submitted data. "
                "Recommend immediate escalation."
            ),
            "extracted_data": {
                "full_name": "Marcus Belmont",
                "date_of_birth": "1985-03-14",
                "document_number": "B1234-56789-01234",
                "expiry_date": "2027-01-15",
                "issuing_authority": "Ontario Ministry of Transportation",
            },
            "document_quality": {
                "overall_quality": "fair",
                "is_blurry": False,
                "is_cropped": False,
                "resolution_adequate": True,
                "issues": [
                    "JPEG artifact anomaly detected around expiry date region",
                    "Font metrics inconsistency in date field",
                ],
            },
            "cross_reference_results": {
                "name_match": True,
                "dob_match": True,
                "name_discrepancy": None,
                "dob_discrepancy": None,
                "document_expired": False,
                "other_discrepancies": ["Expiry date shows signs of digital alteration"],
            },
            "flags": [
                {
                    "description": "Suspected digital alteration of expiry date — font rendering and JPEG artifacts inconsistent with rest of document",
                    "severity": "critical",
                    "field": "expiry_date",
                },
                {
                    "description": "Original expiry likely 2023-01-15 (expired), altered to 2027-01-15",
                    "severity": "critical",
                    "field": "expiry_date",
                },
                {
                    "description": "Compression artifact pattern around date region differs from document baseline",
                    "severity": "warning",
                    "field": "document_quality",
                },
            ],
            "evidence_annotations": [
                {
                    "field": "expiry_date",
                    "extracted_value": "2027-01-15",
                    "submitted_value": None,
                    "location": "Bottom-right of document, below barcode area",
                    "issue_type": "tampering",
                    "severity": "critical",
                    "description": "Expiry date shows inconsistent font weight and JPEG compression artifacts. Pixel analysis suggests the '7' in '2027' was digitally modified from a '3' (original: 2023).",
                },
                {
                    "field": "full_name",
                    "extracted_value": "Marcus Belmont",
                    "submitted_value": "Marcus Belmont",
                    "location": "Center of document, right of photo",
                    "issue_type": "match",
                    "severity": "info",
                    "description": "Name matches submitted data. No signs of alteration.",
                },
                {
                    "field": "date_of_birth",
                    "extracted_value": "1985-03-14",
                    "submitted_value": "1985-03-14",
                    "location": "Center of document, below name",
                    "issue_type": "match",
                    "severity": "info",
                    "description": "Date of birth matches. Font consistent with document template.",
                },
                {
                    "field": "document_number",
                    "extracted_value": "B1234-56789-01234",
                    "submitted_value": None,
                    "location": "Top-right corner",
                    "issue_type": "info",
                    "severity": "info",
                    "description": "Document number clearly readable. No signs of alteration.",
                },
            ],
        },
    },
    "name_mismatch_fraud": {
        "scenario": AdversarialScenario(
            id="name_mismatch_fraud",
            name="Subtle Name Mismatch",
            description="An application where the submitted name is 'Aiden Smyth' but the passport reads 'Aiden Smith'. "
                        "Tests whether the AI catches single-character substitutions that could indicate identity fraud or typo.",
            attack_type="Identity Mismatch",
            expected_outcome="MEDIUM risk — name discrepancy flagged with explanation of possible fraud vs typo",
        ),
        "applicant": {
            "email": "aiden.smyth@example.com",
            "first_name": "Aiden",
            "last_name": "Smyth",
            "date_of_birth": "1992-07-22",
            "address": "100 King Street West, Suite 7070, Toronto, ON M5X 1B1",
            "country": "Canada",
            "document_type": "passport",
        },
        "analysis": {
            "risk_score": 0.55,
            "risk_level": "medium",
            "confidence_score": 0.88,
            "ai_explanation": (
                "Name discrepancy detected: passport reads 'Aiden Smith' but application submitted as 'Aiden Smyth'. "
                "This could be an innocent typo or transliteration difference, but single-character substitutions "
                "are also a common tactic in identity fraud. DOB and other fields match. Recommend manual verification "
                "of the name — request supporting documentation if uncertain."
            ),
            "extracted_data": {
                "full_name": "Aiden Smith",
                "date_of_birth": "1992-07-22",
                "document_number": "GA123456",
                "expiry_date": "2029-11-03",
                "issuing_authority": "Government of Canada",
            },
            "document_quality": {
                "overall_quality": "good",
                "is_blurry": False,
                "is_cropped": False,
                "resolution_adequate": True,
                "issues": [],
            },
            "cross_reference_results": {
                "name_match": False,
                "dob_match": True,
                "name_discrepancy": "Passport: 'Aiden Smith' vs Submitted: 'Aiden Smyth' — 'i→y' substitution in surname",
                "dob_discrepancy": None,
                "document_expired": False,
                "other_discrepancies": [],
            },
            "flags": [
                {
                    "description": "Name mismatch: ID shows 'Smith' but submitted as 'Smyth' — single character substitution (i→y)",
                    "severity": "warning",
                    "field": "full_name",
                },
                {
                    "description": "Single-character name variations can indicate fraud or cultural/regional spelling — manual review recommended",
                    "severity": "warning",
                    "field": "full_name",
                },
            ],
            "evidence_annotations": [
                {
                    "field": "full_name",
                    "extracted_value": "Aiden Smith",
                    "submitted_value": "Aiden Smyth",
                    "location": "Top of bio-data page, below nationality",
                    "issue_type": "mismatch",
                    "severity": "warning",
                    "description": "Surname on passport reads 'SMITH' (machine-readable zone confirms: SMITH). Applicant submitted 'Smyth'. The 'i' → 'y' substitution could be a typo or intentional variation.",
                },
                {
                    "field": "date_of_birth",
                    "extracted_value": "1992-07-22",
                    "submitted_value": "1992-07-22",
                    "location": "Bio-data page, center",
                    "issue_type": "match",
                    "severity": "info",
                    "description": "Date of birth matches submitted data exactly.",
                },
                {
                    "field": "document_number",
                    "extracted_value": "GA123456",
                    "submitted_value": None,
                    "location": "Top-right of bio-data page",
                    "issue_type": "info",
                    "severity": "info",
                    "description": "Passport number clearly legible. Consistent with Canadian passport format.",
                },
                {
                    "field": "expiry_date",
                    "extracted_value": "2029-11-03",
                    "submitted_value": None,
                    "location": "Bio-data page, below date of issue",
                    "issue_type": "info",
                    "severity": "info",
                    "description": "Document is valid and not near expiry.",
                },
            ],
        },
    },
    "blurry_document": {
        "scenario": AdversarialScenario(
            id="blurry_document",
            name="Low-Quality Blurry Document",
            description="An intentionally blurry phone photo of a national ID card. Tests whether the system "
                        "correctly identifies quality issues and reduces confidence, triggering escalation.",
            attack_type="Poor Quality / Evasion",
            expected_outcome="HIGH risk (via low confidence) — escalated for manual review",
        ),
        "applicant": {
            "email": "priya.chakraborty@example.com",
            "first_name": "Priya",
            "last_name": "Chakraborty",
            "date_of_birth": "1990-11-08",
            "address": "45 Bloor Street East, Apt 1201, Toronto, ON M4W 3R5",
            "country": "India",
            "document_type": "national_id",
        },
        "analysis": {
            "risk_score": 0.42,
            "risk_level": "high",
            "confidence_score": 0.35,
            "ai_explanation": (
                "Document quality is too poor for reliable analysis. Significant motion blur affects "
                "all text fields. Name appears to read 'Priya Chakraborty' but confidence is low. "
                "DOB extraction uncertain. Cannot reliably verify document authenticity at this resolution. "
                "Auto-escalated to high risk due to confidence score below 0.6 threshold. "
                "Recommend requesting a new, clearer photo of the document."
            ),
            "extracted_data": {
                "full_name": "Priya Chakraborty",
                "date_of_birth": "1990-11-08",
                "document_number": "XXXXX-XXXX-XXXX",
                "expiry_date": None,
                "issuing_authority": "Government of India",
            },
            "document_quality": {
                "overall_quality": "poor",
                "is_blurry": True,
                "is_cropped": False,
                "resolution_adequate": False,
                "issues": [
                    "Severe motion blur across entire document",
                    "Text fields are partially illegible",
                    "Resolution insufficient for reliable character recognition",
                    "Cannot verify security features at this quality level",
                ],
            },
            "cross_reference_results": {
                "name_match": True,
                "dob_match": True,
                "name_discrepancy": None,
                "dob_discrepancy": "DOB extraction uncertain due to blur — match is tentative",
                "document_expired": False,
                "other_discrepancies": [
                    "Document number partially illegible",
                    "Cannot verify hologram or security features",
                ],
            },
            "flags": [
                {
                    "description": "Document quality too poor for reliable analysis — auto-escalated to high risk",
                    "severity": "critical",
                    "field": "document_quality",
                },
                {
                    "description": "Confidence score 0.35 (below 0.6 threshold) — unreliable extraction",
                    "severity": "critical",
                    "field": "confidence",
                },
                {
                    "description": "Cannot verify security features (hologram, watermark) at this resolution",
                    "severity": "warning",
                    "field": "document_quality",
                },
                {
                    "description": "Request applicant to resubmit with a clearer photo",
                    "severity": "info",
                    "field": None,
                },
            ],
            "evidence_annotations": [
                {
                    "field": "full_name",
                    "extracted_value": "Priya Chakraborty (uncertain)",
                    "submitted_value": "Priya Chakraborty",
                    "location": "Center of document — text area heavily blurred",
                    "issue_type": "blur",
                    "severity": "warning",
                    "description": "Name appears consistent with submitted data, but motion blur makes character-level verification unreliable. Confidence in extraction: ~60%.",
                },
                {
                    "field": "date_of_birth",
                    "extracted_value": "1990-11-08 (uncertain)",
                    "submitted_value": "1990-11-08",
                    "location": "Below name field — heavily blurred",
                    "issue_type": "blur",
                    "severity": "warning",
                    "description": "Date of birth tentatively matches but individual digits are not clearly distinguishable. The '08' could also be '03' or '06'.",
                },
                {
                    "field": "document_number",
                    "extracted_value": "XXXXX-XXXX-XXXX (illegible)",
                    "submitted_value": None,
                    "location": "Top-right area",
                    "issue_type": "blur",
                    "severity": "critical",
                    "description": "Document number is completely illegible due to blur. Cannot verify document identity.",
                },
                {
                    "field": "photo",
                    "extracted_value": None,
                    "submitted_value": None,
                    "location": "Left side of document",
                    "issue_type": "quality",
                    "severity": "warning",
                    "description": "Photo area is blurry but face is partially discernible. Cannot perform reliable facial comparison.",
                },
            ],
        },
    },
    "clean_legitimate": {
        "scenario": AdversarialScenario(
            id="clean_legitimate",
            name="Clean Legitimate Application",
            description="A perfect, clean passport submission with all data matching exactly. Demonstrates "
                        "that the system correctly approves good applications without false positives.",
            attack_type="Baseline (No Attack)",
            expected_outcome="LOW risk — clean pass with high confidence",
        ),
        "applicant": {
            "email": "sarah.chen@example.com",
            "first_name": "Sarah",
            "last_name": "Chen",
            "date_of_birth": "1988-05-16",
            "address": "200 University Avenue, Suite 400, Toronto, ON M5H 3C6",
            "country": "Canada",
            "document_type": "passport",
        },
        "analysis": {
            "risk_score": 0.08,
            "risk_level": "low",
            "confidence_score": 0.96,
            "ai_explanation": (
                "All fields match between submitted data and passport. Document is high quality with "
                "all security features visible. No discrepancies, no quality issues, and no signs of "
                "tampering. This is a straightforward, clean application. Recommend standard processing."
            ),
            "extracted_data": {
                "full_name": "Sarah Chen",
                "date_of_birth": "1988-05-16",
                "document_number": "JK987654",
                "expiry_date": "2031-02-28",
                "issuing_authority": "Government of Canada",
            },
            "document_quality": {
                "overall_quality": "good",
                "is_blurry": False,
                "is_cropped": False,
                "resolution_adequate": True,
                "issues": [],
            },
            "cross_reference_results": {
                "name_match": True,
                "dob_match": True,
                "name_discrepancy": None,
                "dob_discrepancy": None,
                "document_expired": False,
                "other_discrepancies": [],
            },
            "flags": [
                {
                    "description": "All data points match — no discrepancies detected",
                    "severity": "info",
                    "field": None,
                },
            ],
            "evidence_annotations": [
                {
                    "field": "full_name",
                    "extracted_value": "Sarah Chen",
                    "submitted_value": "Sarah Chen",
                    "location": "Bio-data page, center",
                    "issue_type": "match",
                    "severity": "info",
                    "description": "Name matches exactly. Machine-readable zone confirms: CHEN / SARAH.",
                },
                {
                    "field": "date_of_birth",
                    "extracted_value": "1988-05-16",
                    "submitted_value": "1988-05-16",
                    "location": "Bio-data page, below name",
                    "issue_type": "match",
                    "severity": "info",
                    "description": "Date of birth matches submitted data exactly.",
                },
                {
                    "field": "document_number",
                    "extracted_value": "JK987654",
                    "submitted_value": None,
                    "location": "Top-right of bio-data page",
                    "issue_type": "info",
                    "severity": "info",
                    "description": "Passport number clearly legible and consistent with Canadian format.",
                },
                {
                    "field": "expiry_date",
                    "extracted_value": "2031-02-28",
                    "submitted_value": None,
                    "location": "Bio-data page, below issue date",
                    "issue_type": "info",
                    "severity": "info",
                    "description": "Document valid until 2031. No expiry concerns.",
                },
            ],
        },
    },
}


@router.get("/scenarios")
def list_scenarios():
    return [v["scenario"] for v in SCENARIOS.values()]


@router.post("/run-scenario/{scenario_id}", response_model=AdversarialTestResponse)
def run_scenario(scenario_id: str, db: Session = Depends(get_db)):
    if scenario_id not in SCENARIOS:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}")

    data = SCENARIOS[scenario_id]
    applicant = data["applicant"]
    analysis = data["analysis"]
    scenario = data["scenario"]

    reg = screen_application(
        country=applicant["country"],
        risk_score=analysis["risk_score"],
        risk_level=analysis["risk_level"],
        confidence_score=analysis["confidence_score"],
        cross_reference_results=analysis.get("cross_reference_results"),
        document_quality=analysis.get("document_quality"),
        flags=analysis.get("flags"),
        first_name=applicant["first_name"],
        last_name=applicant["last_name"],
    )

    app = Application(
        email=applicant.get("email"),
        first_name=applicant["first_name"],
        last_name=applicant["last_name"],
        date_of_birth=applicant["date_of_birth"],
        address=applicant["address"],
        country=applicant["country"],
        document_type=applicant["document_type"],
        document_paths=[],
        status=ApplicationStatus.PENDING_REVIEW.value,
        risk_score=reg["adjusted_risk_score"],
        risk_level=reg["adjusted_risk_level"],
        confidence_score=analysis["confidence_score"],
        ai_explanation=analysis["ai_explanation"],
        extracted_data=analysis["extracted_data"],
        flags=analysis["flags"],
        cross_reference_results=analysis["cross_reference_results"],
        document_quality=analysis["document_quality"],
        evidence_annotations=analysis.get("evidence_annotations"),
        regulatory_flags=reg["regulatory_flags"],
        regulatory_priority=reg["priority"],
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    audit.log_event(
        db,
        action="adversarial_test",
        actor="demo_system",
        application_id=app.id,
        details={
            "scenario_id": scenario_id,
            "scenario_name": scenario.name,
            "attack_type": scenario.attack_type,
            "risk_score": analysis["risk_score"],
            "risk_level": analysis["risk_level"],
        },
    )

    return AdversarialTestResponse(
        application_id=app.id,
        scenario=scenario,
        message=f"Scenario '{scenario.name}' created — navigate to application detail to see AI analysis",
    )
