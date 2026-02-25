"""
Persistent screening configuration — stored as a JSON file.
All regulatory checks read from this config so admins can adjust thresholds,
country lists, and toggle checks without code changes.
"""

import json
import os
from pathlib import Path
from threading import Lock

CONFIG_PATH = Path(os.getenv("SCREENING_CONFIG_PATH", "screening_config.json"))

_lock = Lock()

DEFAULT_CONFIG: dict = {
    "checks": {
        "jurisdiction": {"enabled": True, "label": "Jurisdiction Risk Screening"},
        "sanctions": {"enabled": True, "label": "Sanctions Screening"},
        "pep": {"enabled": True, "label": "PEP (Politically Exposed Persons)"},
        "adverse_media": {"enabled": True, "label": "Adverse Media Screening"},
        "document_expiry": {"enabled": True, "label": "Document Expiry Check"},
        "ai_confidence": {"enabled": True, "label": "AI Confidence Threshold"},
        "critical_flags": {"enabled": True, "label": "Critical AI Flags Escalation"},
        "document_quality": {"enabled": True, "label": "Document Quality Check"},
    },
    "high_risk_countries": [
        "Iran", "North Korea", "Myanmar", "Syria", "Yemen",
        "South Sudan", "Democratic Republic of Congo",
        "Libya", "Somalia", "Afghanistan",
        "Haiti", "Albania", "Barbados", "Burkina Faso",
        "Cayman Islands", "Jamaica", "Jordan", "Mali",
        "Morocco", "Mozambique", "Panama", "Philippines",
        "Senegal", "Tanzania", "Turkey", "Uganda",
        "United Arab Emirates", "Vietnam",
    ],
    "elevated_countries": [
        "Nigeria", "Pakistan", "Bangladesh", "Cambodia",
        "Ghana", "Kenya", "Laos", "Nicaragua",
        "Zimbabwe", "Venezuela", "South Africa",
    ],
    "sanctioned_countries": [
        "Iran", "North Korea", "Syria", "Cuba",
    ],
    "sanctions_programs": [
        "OFAC SDN List",
        "UN Security Council Consolidated List",
        "EU Consolidated Sanctions List",
        "Canada SEMA (Special Economic Measures Act)",
        "FINTRAC Designated Persons",
    ],
    "thresholds": {
        "ai_confidence_min": 0.6,
        "risk_high": 0.7,
        "risk_medium": 0.3,
    },
    "boosts": {
        "high_risk_country": 0.25,
        "elevated_country": 0.10,
        "expired_document": 0.15,
        "low_confidence": 0.20,
        "sanctions_match": 0.50,
        "pep_match": 0.35,
        "adverse_media": 0.15,
    },
}


def _deep_merge(base: dict, override: dict) -> dict:
    """Merge override into base, preserving keys not in override."""
    result = base.copy()
    for k, v in override.items():
        if k in result and isinstance(result[k], dict) and isinstance(v, dict):
            result[k] = _deep_merge(result[k], v)
        else:
            result[k] = v
    return result


def load_config() -> dict:
    with _lock:
        if CONFIG_PATH.exists():
            try:
                saved = json.loads(CONFIG_PATH.read_text())
                return _deep_merge(DEFAULT_CONFIG, saved)
            except (json.JSONDecodeError, OSError):
                pass
        return DEFAULT_CONFIG.copy()


def save_config(config: dict) -> dict:
    with _lock:
        merged = _deep_merge(DEFAULT_CONFIG, config)
        CONFIG_PATH.write_text(json.dumps(merged, indent=2))
        return merged


def is_check_enabled(config: dict, check_name: str) -> bool:
    return config.get("checks", {}).get(check_name, {}).get("enabled", True)
