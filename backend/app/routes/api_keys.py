import secrets
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_db
from app.models.application import ApiKey, User
from app.services.auth import require_admin

router = APIRouter(prefix="/api/api-keys", tags=["api-keys"])


def _hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


class CreateKeyRequest(BaseModel):
    name: str


class ApiKeyResponse(BaseModel):
    id: str
    name: str
    key_prefix: str
    created_at: datetime
    last_used_at: datetime | None
    is_active: bool
    scopes: list[str]
    model_config = {"from_attributes": True}


@router.post("")
def create_api_key(req: CreateKeyRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    raw_key = f"vf_live_{secrets.token_urlsafe(32)}"
    key = ApiKey(
        name=req.name,
        key_hash=_hash_key(raw_key),
        key_prefix=raw_key[:10],
        owner_id=admin.id,
    )
    db.add(key)
    db.commit()
    return {"id": key.id, "name": key.name, "key": raw_key, "prefix": key.key_prefix, "message": "Save this key — it won't be shown again."}


@router.get("")
def list_api_keys(db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    keys = db.query(ApiKey).filter(ApiKey.is_active == True).order_by(ApiKey.created_at.desc()).all()
    return [ApiKeyResponse.model_validate(k) for k in keys]


@router.delete("/{key_id}")
def revoke_api_key(key_id: str, db: Session = Depends(get_db), _admin: User = Depends(require_admin)):
    key = db.query(ApiKey).filter(ApiKey.id == key_id).first()
    if not key:
        raise HTTPException(404, "API key not found")
    key.is_active = False
    db.commit()
    return {"message": "API key revoked"}
