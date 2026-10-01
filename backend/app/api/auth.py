from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User, RefreshToken
from app.core.security import (
    verify_password,
    hash_password,
    create_access_token,
    create_refresh_token,
    hash_refresh_token,
    decode_token,
)
from app.core.deps import get_current_user, require_roles
from app.schemas.auth import (
    LoginRequest, TokenResponse, RefreshRequest, UserOut, UserCreateRequest, AcceptInviteRequest, ChangePasswordRequest, ProfileUpdateRequest,
)
from app.core.config import get_settings
import hashlib
from app.models.user import Role, UserRole
from app.models.enums import RoleName
from app.services.audit import record_audit
from app.models.enums import AuditAction

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


def _issue_tokens(db: Session, user: User) -> TokenResponse:
    access = create_access_token(user.id, user.role_names)
    refresh, refresh_hash, expires_at = create_refresh_token(user.id)
    db.add(RefreshToken(user_id=user.id, token_hash=refresh_hash, expires_at=expires_at))
    db.commit()
    return TokenResponse(access_token=access, refresh_token=refresh, must_change_password=user.must_change_password)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == payload.email.lower(), User.deleted_at.is_(None)))
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": {"code": "INVALID_LOGIN", "message": "Invalid email or password"}},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"success": False, "error": {"code": "ACCOUNT_DISABLED", "message": "Account is disabled"}},
        )
    if user.invite_token_hash and not user.invite_accepted_at:
        user.invite_accepted_at = datetime.now(timezone.utc)  # first sign-in counts as accepting
    return _issue_tokens(db, user)


@router.post("/accept-invite")
def accept_invite(payload: AcceptInviteRequest, db: Session = Depends(get_db)):
    """Public: the emailed link marks the invitation as accepted."""
    token_hash = hashlib.sha256(payload.token.encode()).hexdigest()
    user = db.scalar(select(User).where(User.invite_token_hash == token_hash, User.deleted_at.is_(None)))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_INVITE", "message": "This invitation link is invalid or has been replaced."}},
        )
    if not user.invite_accepted_at:
        if user.invite_expires_at and user.invite_expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"success": False, "error": {"code": "INVITE_EXPIRED", "message": "This invitation has expired. Ask your admin to resend it."}},
            )
        user.invite_accepted_at = datetime.now(timezone.utc)
        db.commit()
    return {"email": user.email, "must_change_password": user.must_change_password}


@router.post("/change-password")
def change_password(payload: ChangePasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    def bad(code: str, msg: str):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"success": False, "error": {"code": code, "message": msg}})

    if not verify_password(payload.current_password, current_user.hashed_password):
        raise bad("WRONG_PASSWORD", "Your current password is incorrect")
    if payload.new_password == payload.current_password or payload.new_password == settings.DEFAULT_USER_PASSWORD:
        raise bad("PASSWORD_REUSE", "Choose a new password that is different from the temporary one")
    current_user.hashed_password = hash_password(payload.new_password)
    current_user.must_change_password = False
    db.commit()
    return {"success": True}


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)):
    try:
        decoded = decode_token(payload.refresh_token)
        if decoded.get("type") != "refresh":
            raise ValueError()
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": {"code": "INVALID_REFRESH_TOKEN", "message": "Invalid refresh token"}},
        )

    token_hash = hash_refresh_token(payload.refresh_token)
    stored = db.scalar(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    if not stored or stored.revoked or stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"success": False, "error": {"code": "INVALID_REFRESH_TOKEN", "message": "Refresh token expired or revoked"}},
        )
    stored.revoked = True
    user = db.get(User, decoded["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return _issue_tokens(db, user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        roles=current_user.role_names,
        is_active=current_user.is_active,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        must_change_password=current_user.must_change_password,
    )


@router.put("/me", response_model=UserOut)
def update_profile(payload: ProfileUpdateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.first_name = payload.first_name.strip()
    current_user.last_name = payload.last_name.strip()
    current_user.full_name = f"{current_user.first_name} {current_user.last_name}"
    db.commit()
    return me(current_user)


@router.post("/users", response_model=UserOut, dependencies=[Depends(require_roles(RoleName.ADMIN.value))])
def create_user(payload: UserCreateRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if db.scalar(select(User).where(User.email == payload.email)):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"success": False, "error": {"code": "EMAIL_EXISTS", "message": "A user with this email already exists"}},
        )
    user = User(email=payload.email, full_name=payload.full_name, hashed_password=hash_password(payload.password))
    db.add(user)
    db.flush()
    for role_name in payload.roles:
        role = db.scalar(select(Role).where(Role.name == role_name))
        if role:
            db.add(UserRole(user_id=user.id, role_id=role.id))
    db.commit()
    db.refresh(user)
    record_audit(db, current_user.id, AuditAction.USER_CREATED, "User", user.id)
    return UserOut(id=user.id, email=user.email, full_name=user.full_name, roles=user.role_names, is_active=user.is_active)
