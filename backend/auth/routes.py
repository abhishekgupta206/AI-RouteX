from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from .database import get_db
from .models import User
from .security import hash_password, verify_password

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(data: SignupRequest, db: Session = Depends(get_db)):
    email = data.email.lower().strip()

    if len(data.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters.",
        )

    existing_user = db.query(User).filter(User.email == email).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="An account with this email already exists.",
        )

    user = User(
        name=data.name.strip(),
        email=email,
        password_hash=hash_password(data.password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "message": "Account created successfully.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "is_verified": user.is_verified,
        },
    }


@router.post("/login")
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    email = data.email.lower().strip()

    user = db.query(User).filter(User.email == email).first()

    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=403,
            detail="This account is disabled.",
        )

    response.set_cookie(
        key="airoutex_session",
        value=str(user.id),
        httponly=True,
        samesite="lax",
        secure=False,
        max_age=60 * 60 * 24 * 7,
    )

    return {
        "message": "Login successful.",
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "is_verified": user.is_verified,
        },
    }


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("airoutex_session")

    return {
        "message": "Logged out successfully."
    }


@router.get("/me")
def me(db: Session = Depends(get_db)):
    return {
        "message": "Authentication endpoint is ready."
    }