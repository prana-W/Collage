import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from db.database import get_db
from db.models import User, College
from utils.auth_utils import (
    slugify,
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])
security = HTTPBearer()

# --- Pydantic Schemas ---

class AdminRegisterRequest(BaseModel):
    name: str = Field(..., example="Admin User")
    email: EmailStr = Field(..., example="admin@nitjsr.ac.in")
    password: str = Field(..., min_length=6, example="securePassword123")
    college_name: str = Field(..., example="NIT Jamshedpur")


class UserRegisterRequest(BaseModel):
    name: str = Field(..., example="John Doe")
    email: EmailStr = Field(..., example="student@nitjsr.ac.in")
    password: str = Field(..., min_length=6, example="studentPassword123")
    college_slug: str = Field(..., example="nit-jamshedpur")


class LoginRequest(BaseModel):
    email: EmailStr = Field(..., example="student@nitjsr.ac.in")
    password: str = Field(..., example="studentPassword123")


# --- Auth Dependency ---

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return user


# --- Endpoints ---

@router.post("/admin/register", status_code=status.HTTP_201_CREATED, summary="Register an Admin and College")
def register_admin(req: AdminRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers an Admin user and defines their college.
    Automatically generates a clean college_slug from the provided college_name.
    """
    # 1. Check if email exists
    existing_user = db.query(User).filter(User.email == req.email.strip().lower()).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # 2. Slugify college name
    slug = slugify(req.college_name)
    if not slug:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid college name provided."
        )

    # 3. Create or retrieve College
    college = db.query(College).filter(College.slug == slug).first()
    if not college:
        college = College(name=req.college_name.strip(), slug=slug)
        db.add(college)
        db.commit()
        db.refresh(college)

    # 4. Hash password and create Admin User
    hashed_pwd = hash_password(req.password)
    admin_user = User(
        name=req.name.strip(),
        email=req.email.strip().lower(),
        hashed_password=hashed_pwd,
        role="admin",
        college_slug=slug,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    # 5. Generate 7-day JWT token
    access_token = create_access_token(data={
        "user_id": admin_user.id,
        "email": admin_user.email,
        "role": admin_user.role,
        "college_slug": admin_user.college_slug,
    })

    return {
        "message": "Admin and College registered successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": admin_user.to_dict(),
        "college": college.to_dict(),
    }


@router.post("/user/register", status_code=status.HTTP_201_CREATED, summary="Register a Standard User")
def register_user(req: UserRegisterRequest, db: Session = Depends(get_db)):
    """
    Registers a standard user associated with a specific college_slug.
    """
    clean_email = req.email.strip().lower()
    clean_slug = req.college_slug.strip().lower()

    # 1. Check if user email already exists
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists."
        )

    # 2. Hash password and create User
    hashed_pwd = hash_password(req.password)
    new_user = User(
        name=req.name.strip(),
        email=clean_email,
        hashed_password=hashed_pwd,
        role="user",
        college_slug=clean_slug,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 3. Generate 7-day JWT token
    access_token = create_access_token(data={
        "user_id": new_user.id,
        "email": new_user.email,
        "role": new_user.role,
        "college_slug": new_user.college_slug,
    })

    return {
        "message": "User registered successfully.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": new_user.to_dict(),
    }


@router.post("/login", summary="Login with Email and Password")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user/admin with email & password and returns a 7-day JWT access token.
    """
    clean_email = req.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={
        "user_id": user.id,
        "email": user.email,
        "role": user.role,
        "college_slug": user.college_slug,
    })

    return {
        "message": "Login successful.",
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.to_dict(),
    }


@router.get("/me", summary="Get Current Logged-in User Profile")
def get_me(current_user: User = Depends(get_current_user)):
    """
    Returns the profile of the currently authenticated user based on Bearer token.
    """
    return {
        "user": current_user.to_dict()
    }
