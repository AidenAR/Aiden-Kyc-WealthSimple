from fastapi import APIRouter
from pydantic import BaseModel

from app.services.screening_config import load_config, save_config

router = APIRouter(prefix="/api/config", tags=["config"])


class ScreeningConfigUpdate(BaseModel):
    checks: dict | None = None
    high_risk_countries: list[str] | None = None
    elevated_countries: list[str] | None = None
    sanctioned_countries: list[str] | None = None
    sanctions_programs: list[str] | None = None
    thresholds: dict | None = None
    boosts: dict | None = None
    auto_approve: dict | None = None


@router.get("/screening")
def get_screening_config():
    return load_config()


@router.put("/screening")
def update_screening_config(body: ScreeningConfigUpdate):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    saved = save_config(update)
    return saved
