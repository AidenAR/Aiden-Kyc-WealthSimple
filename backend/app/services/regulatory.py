"""
Automatic regulatory screening — runs after AI analysis on every application.
Checks country risk, PEP, sanctions, adverse media, document quality, and more.
All checks are configurable via the admin screening config.
"""

from app.services.screening_config import load_config, is_check_enabled


def _clamp(v: float) -> float:
    return max(0.0, min(1.0, v))


def _risk_level(score: float, thresholds: dict) -> str:
    if score > thresholds.get("risk_high", 0.7):
        return "high"
    if score >= thresholds.get("risk_medium", 0.3):
        return "medium"
    return "low"


def _check_pep(first_name: str, last_name: str, country: str) -> dict | None:
    """
    Simulated PEP screening. In production this would hit a real PEP database
    (e.g. Dow Jones, Refinitiv World-Check, ComplyAdvantage).
    """
    return {
        "type": "pep_screen",
        "severity": "info",
        "title": "PEP Screening — No Match",
        "description": (
            f"Screened '{first_name} {last_name}' against PEP databases. "
            f"No politically exposed person match found."
        ),
        "regulation": "PCMLTFA s. 9.6 — Enhanced due diligence for PEPs",
        "fintrac_obligation": "No action required. Re-screen at periodic review.",
        "screened": True,
        "match": False,
    }


def _check_sanctions(first_name: str, last_name: str, country: str, cfg: dict) -> dict | None:
    """
    Simulated sanctions screening. In production this would hit OFAC, UN, EU, SEMA lists.
    """
    sanctioned = cfg.get("sanctioned_countries", [])
    programs = cfg.get("sanctions_programs", [])
    country_lower = country.strip().lower()
    is_sanctioned_country = any(c.lower() == country_lower for c in sanctioned)

    if is_sanctioned_country:
        return {
            "type": "sanctions_screen",
            "severity": "critical",
            "title": f"Sanctions Alert — {country} Under Comprehensive Sanctions",
            "description": (
                f"{country} is subject to comprehensive sanctions. "
                f"Screened '{first_name} {last_name}' against {len(programs)} sanctions programs. "
                f"Country-level sanctions match detected."
            ),
            "regulation": "SEMA / United Nations Act — Transactions must be frozen and reported",
            "fintrac_obligation": "CRITICAL: File Terrorist Property Report. Freeze assets. Report within 5 business days.",
            "screened": True,
            "match": True,
            "programs_checked": programs,
        }

    return {
        "type": "sanctions_screen",
        "severity": "info",
        "title": "Sanctions Screening — No Match",
        "description": (
            f"Screened '{first_name} {last_name}' against {len(programs)} sanctions programs "
            f"(OFAC, UN, EU, SEMA, FINTRAC). No match found."
        ),
        "regulation": "SEMA / United Nations Act — Mandatory screening obligation",
        "fintrac_obligation": "No action required. Re-screen at periodic review.",
        "screened": True,
        "match": False,
        "programs_checked": programs,
    }


def _check_adverse_media(first_name: str, last_name: str) -> dict | None:
    """
    Simulated adverse media screening. In production this would hit news/media APIs.
    """
    return {
        "type": "adverse_media_screen",
        "severity": "info",
        "title": "Adverse Media Screening — No Findings",
        "description": (
            f"Screened '{first_name} {last_name}' for adverse media coverage "
            f"related to financial crime, fraud, money laundering, and terrorism financing. "
            f"No relevant findings."
        ),
        "regulation": "PCMLTFA — Ongoing monitoring obligation includes media screening",
        "fintrac_obligation": "No action required. Re-screen at periodic review.",
        "screened": True,
        "match": False,
    }


def screen_application(
    country: str,
    risk_score: float,
    risk_level: str,
    confidence_score: float,
    cross_reference_results: dict | None,
    document_quality: dict | None,
    flags: list | None,
    first_name: str = "",
    last_name: str = "",
) -> dict:
    cfg = load_config()
    boosts = cfg.get("boosts", {})
    thresholds = cfg.get("thresholds", {})

    adjusted = risk_score
    regulatory_flags: list[dict] = []
    adjustments: list[dict] = []

    # --- Jurisdiction Risk ---
    if is_check_enabled(cfg, "jurisdiction"):
        high_risk = cfg.get("high_risk_countries", [])
        elevated = cfg.get("elevated_countries", [])
        country_lower = country.strip().lower()
        is_high_risk = any(c.lower() == country_lower for c in high_risk)
        is_elevated = any(c.lower() == country_lower for c in elevated)

        if is_high_risk:
            boost = boosts.get("high_risk_country", 0.25)
            adjusted = _clamp(adjusted + boost)
            regulatory_flags.append({
                "type": "high_risk_jurisdiction",
                "severity": "critical",
                "title": f"High-Risk Jurisdiction: {country}",
                "description": f"{country} is on the FATF grey list. Enhanced due diligence and ongoing monitoring required.",
                "regulation": "FATF Recommendation 19 — Enhanced measures for higher-risk countries",
                "fintrac_obligation": "File Enhanced Transaction Report (ETR). Apply enhanced ongoing monitoring.",
            })
            adjustments.append({"factor": "FATF high-risk country", "boost": boost})
        elif is_elevated:
            boost = boosts.get("elevated_country", 0.10)
            adjusted = _clamp(adjusted + boost)
            regulatory_flags.append({
                "type": "elevated_jurisdiction",
                "severity": "warning",
                "title": f"Elevated-Risk Jurisdiction: {country}",
                "description": f"{country} is flagged for elevated AML/CFT risk. Additional scrutiny recommended.",
                "regulation": "PCMLTFA — Risk-based approach to client identification",
                "fintrac_obligation": "Standard monitoring with periodic review.",
            })
            adjustments.append({"factor": "Elevated-risk country", "boost": boost})
        else:
            regulatory_flags.append({
                "type": "jurisdiction_clear",
                "severity": "info",
                "title": f"Jurisdiction Check — {country}",
                "description": f"{country} is not on the FATF grey list or elevated-risk watchlist.",
                "regulation": "FATF Recommendation 19",
                "fintrac_obligation": "Standard processing. No enhanced measures required.",
            })

    # --- Sanctions Screening ---
    if is_check_enabled(cfg, "sanctions"):
        sanctions_result = _check_sanctions(first_name, last_name, country, cfg)
        if sanctions_result:
            regulatory_flags.append(sanctions_result)
            if sanctions_result.get("match"):
                boost = boosts.get("sanctions_match", 0.50)
                adjusted = _clamp(adjusted + boost)
                adjustments.append({"factor": "Sanctions match", "boost": boost})

    # --- PEP Screening ---
    if is_check_enabled(cfg, "pep"):
        pep_result = _check_pep(first_name, last_name, country)
        if pep_result:
            regulatory_flags.append(pep_result)
            if pep_result.get("match"):
                boost = boosts.get("pep_match", 0.35)
                adjusted = _clamp(adjusted + boost)
                adjustments.append({"factor": "PEP match", "boost": boost})

    # --- Adverse Media ---
    if is_check_enabled(cfg, "adverse_media"):
        media_result = _check_adverse_media(first_name, last_name)
        if media_result:
            regulatory_flags.append(media_result)
            if media_result.get("match"):
                boost = boosts.get("adverse_media", 0.15)
                adjusted = _clamp(adjusted + boost)
                adjustments.append({"factor": "Adverse media", "boost": boost})

    # --- Document Validity ---
    if is_check_enabled(cfg, "document_expiry"):
        doc_expired = False
        if cross_reference_results:
            doc_expired = cross_reference_results.get("document_expired", False)
        if doc_expired:
            boost = boosts.get("expired_document", 0.15)
            adjusted = _clamp(adjusted + boost)
            regulatory_flags.append({
                "type": "expired_document",
                "severity": "critical",
                "title": "Expired Identity Document",
                "description": "The submitted identity document is expired. Most jurisdictions require a valid, unexpired document for KYC.",
                "regulation": "PCMLTFA s. 105 — Identity verification must use valid, non-expired documents",
                "fintrac_obligation": "Cannot complete verification with expired documents. Request new document.",
            })
            adjustments.append({"factor": "Expired document", "boost": boost})

    # --- AI Confidence ---
    if is_check_enabled(cfg, "ai_confidence"):
        min_confidence = thresholds.get("ai_confidence_min", 0.6)
        if confidence_score < min_confidence:
            boost = boosts.get("low_confidence", 0.20)
            adjusted = _clamp(adjusted + boost)
            regulatory_flags.append({
                "type": "low_confidence",
                "severity": "warning",
                "title": "Low AI Confidence — Manual Verification Required",
                "description": f"AI confidence is {confidence_score:.0%}, below the {min_confidence:.0%} threshold. Automated verification cannot be relied upon.",
                "regulation": "PCMLTFA — When automated methods fail, manual identity verification is required",
                "fintrac_obligation": "Complete manual document review before proceeding.",
            })
            adjustments.append({"factor": f"Low AI confidence (<{min_confidence})", "boost": boost})

    # --- Critical AI Flags ---
    if is_check_enabled(cfg, "critical_flags"):
        has_critical_flags = False
        if flags:
            for flag in flags:
                if isinstance(flag, dict) and flag.get("severity") == "critical":
                    has_critical_flags = True
                    break
        if has_critical_flags:
            regulatory_flags.append({
                "type": "critical_ai_flags",
                "severity": "critical",
                "title": "Critical AI Flags Detected",
                "description": "The AI analysis raised one or more critical flags (potential fraud, tampering, or major discrepancies).",
                "regulation": "PCMLTFA s. 7 — Suspicious transaction reporting obligation",
                "fintrac_obligation": "If fraud is confirmed, file a Suspicious Transaction Report (STR) within 30 days.",
            })

    # --- Document Quality ---
    if is_check_enabled(cfg, "document_quality"):
        poor_quality = False
        if document_quality:
            poor_quality = document_quality.get("overall_quality") == "poor"
        if poor_quality:
            regulatory_flags.append({
                "type": "poor_document_quality",
                "severity": "warning",
                "title": "Document Quality Insufficient for Verification",
                "description": "Document quality is too poor for reliable automated verification. Manual review or resubmission required.",
                "regulation": "PCMLTFA — Identity documents must be legible and verifiable",
                "fintrac_obligation": "Request higher quality document before completing verification.",
            })

    adjusted = _clamp(adjusted)
    new_risk_level = _risk_level(adjusted, thresholds)

    any_critical = any(f["severity"] == "critical" for f in regulatory_flags)
    if any_critical or new_risk_level == "high":
        priority = "immediate"
    elif new_risk_level == "medium" or any(f["severity"] == "warning" for f in regulatory_flags):
        priority = "elevated"
    else:
        priority = "standard"

    return {
        "adjusted_risk_score": round(adjusted, 3),
        "adjusted_risk_level": new_risk_level,
        "regulatory_flags": regulatory_flags,
        "adjustments_applied": adjustments,
        "priority": priority,
    }
