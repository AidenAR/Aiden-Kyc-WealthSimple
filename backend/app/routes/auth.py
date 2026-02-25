from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.application import User
from app.services.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    role_for_email,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _user_dict(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "role": user.role,
    }


@router.post("/register")
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(req.password),
        name=req.name.strip() or email.split("@")[0],
        role=role_for_email(email),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, user.email, user.role)
    return {"token": token, "user": _user_dict(user)}


@router.post("/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")

    token = create_access_token(user.id, user.email, user.role)
    return {"token": token, "user": _user_dict(user)}


@router.get("/me")
def get_me(user: User = Depends(get_current_user)):
    return _user_dict(user)
