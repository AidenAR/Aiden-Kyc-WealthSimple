from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.application import Application
from app.schemas.application import RegulatorySimRequest, RegulatorySimResponse
from app.services import audit

router = APIRouter(prefix="/api", tags=["simulator"])

HIGH_RISK_COUNTRIES = [
    "Iran", "North Korea", "Myanmar", "Syria", "Yemen",
    "South Sudan", "Democratic Republic of Congo",
    "Libya", "Somalia", "Afghanistan",
    "Haiti", "Albania", "Barbados", "Burkina Faso",
    "Cayman Islands", "Jamaica", "Jordan", "Mali",
    "Morocco", "Mozambique", "Panama", "Philippines",
    "Senegal", "Tanzania", "Turkey", "Uganda",
    "United Arab Emirates", "Vietnam",
]

SANCTIONS_PROGRAMS = [
    "OFAC SDN List",
    "UN Security Council",
    "EU Consolidated List",
    "Canada SEMA (Special Economic Measures Act)",
    "FINTRAC Designated Persons",
]

PEP_RISK_BOOST = 0.35
COUNTRY_RISK_BOOST = 0.25
SANCTIONS_RISK_BOOST = 0.50
ADVERSE_MEDIA_RISK_BOOST = 0.15


def _clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def _risk_level(score: float) -> str:
    if score > 0.7:
        return "high"
    if score >= 0.3:
        return "medium"
    return "low"


@router.get("/simulator/high-risk-countries")
def list_high_risk_countries():
    """FATF grey-list and sanctioned jurisdictions."""
    return {"countries": HIGH_RISK_COUNTRIES}


@router.post(
    "/applications/{application_id}/simulate-regulatory",
    response_model=RegulatorySimResponse,
)
def simulate_regulatory(
    application_id: str,
    sim: RegulatorySimRequest,
    db: Session = Depends(get_db),
):
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    base_score = app.risk_score if app.risk_score is not None else 0.15
    adjusted = base_score
    adjustments: list[dict] = []
    fintrac_flags: list[str] = []

    if sim.pep_match:
        adjusted = _clamp(adjusted + PEP_RISK_BOOST)
        adjustments.append({
            "factor": "Politically Exposed Person (PEP)",
            "boost": PEP_RISK_BOOST,
            "regulation": "PCMLTFA s. 9.6 — Enhanced due diligence required for PEPs",
        })
        fintrac_flags.append("PEP — requires senior management approval per FINTRAC guidelines")

    if sim.high_risk_country:
        adjusted = _clamp(adjusted + COUNTRY_RISK_BOOST)
        country_note = f"Applicant country: {app.country}"
        is_listed = app.country in HIGH_RISK_COUNTRIES
        adjustments.append({
            "factor": "High-Risk Jurisdiction",
            "boost": COUNTRY_RISK_BOOST,
            "regulation": "FATF Recommendation 19 — Enhanced measures for higher-risk countries",
            "note": f"{country_note} ({'listed' if is_listed else 'not on FATF grey list'})",
        })
        fintrac_flags.append("High-risk jurisdiction — enhanced monitoring and reporting required")

    if sim.sanctions_hit:
        adjusted = _clamp(adjusted + SANCTIONS_RISK_BOOST)
        adjustments.append({
            "factor": "Sanctions Match",
            "boost": SANCTIONS_RISK_BOOST,
            "regulation": "SEMA / United Nations Act — Transaction must be frozen and reported",
            "programs_checked": SANCTIONS_PROGRAMS,
        })
        fintrac_flags.append("CRITICAL: Potential sanctions match — must file STR within 3 days")

    if sim.adverse_media:
        adjusted = _clamp(adjusted + ADVERSE_MEDIA_RISK_BOOST)
        adjustments.append({
            "factor": "Adverse Media",
            "boost": ADVERSE_MEDIA_RISK_BOOST,
            "regulation": "PCMLTFA — Ongoing monitoring obligation; adverse media triggers review",
        })
        fintrac_flags.append("Adverse media detected — manual review required before proceeding")

    adjusted = _clamp(adjusted)
    risk_level = _risk_level(adjusted)

    if sim.sanctions_hit:
        priority = "blocked"
    elif risk_level == "high" or sim.pep_match:
        priority = "immediate"
    elif risk_level == "medium":
        priority = "elevated"
    else:
        priority = "standard"

    parts = []
    if sim.pep_match:
        parts.append("PEP status detected")
    if sim.high_risk_country:
        parts.append(f"high-risk jurisdiction ({app.country})")
    if sim.sanctions_hit:
        parts.append("potential sanctions match")
    if sim.adverse_media:
        parts.append("adverse media findings")

    if parts:
        explanation = (
            f"Regulatory simulation applied {len(adjustments)} adjustment(s): "
            f"{', '.join(parts)}. "
            f"Risk score moved from {base_score:.2f} to {adjusted:.2f} ({risk_level} risk). "
            f"Priority level: {priority}."
        )
    else:
        explanation = "No regulatory factors applied. Risk assessment unchanged."

    audit.log_event(
        db,
        action="regulatory_simulation",
        actor="compliance_officer",
        application_id=application_id,
        details={
            "toggles": sim.model_dump(),
            "original_score": base_score,
            "adjusted_score": adjusted,
            "priority": priority,
        },
    )

    return RegulatorySimResponse(
        original_risk_score=app.risk_score,
        original_risk_level=app.risk_level,
        adjusted_risk_score=round(adjusted, 3),
        adjusted_risk_level=risk_level,
        adjustments=adjustments,
        fintrac_flags=fintrac_flags,
        priority=priority,
        explanation=explanation,
    )
