import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.deps import get_current_user, require_roles
from app.core.security import hash_password
from app.db.session import get_db
from app.models.enums import AuditAction, RoleName
from app.models.user import Role, User, UserRole
from app.services.audit import record_audit
from app.services.email import EmailError, send_email
from app.services.organization import get_org_name
from app.services.invite_email import get_template, render_invite, template_to_dict

router = APIRouter(prefix="/api/team", tags=["team"], dependencies=[Depends(require_roles(RoleName.ADMIN.value))])
settings = get_settings()

ROLE_INFO = {
    "ADMIN": {"label": "Admin", "description": "Full access to organization settings, accounts and members"},
    "PUBLISHER": {"label": "Publisher", "description": "Create, schedule and publish posts; no org settings or team management"},
}


def _err(code: str, message: str, http: int = status.HTTP_400_BAD_REQUEST) -> HTTPException:
    return HTTPException(status_code=http, detail={"success": False, "error": {"code": code, "message": message}})


class MemberOut(BaseModel):
    id: str
    first_name: str | None
    last_name: str | None
    full_name: str
    email: str
    role: str
    status: str
    created_at: datetime
    invite_accepted_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class InviteRequest(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    role: RoleName


class MemberUpdate(BaseModel):
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    role: RoleName


class InviteResult(BaseModel):
    member: MemberOut
    email_sent: bool
    email_error: str | None = None


def _member_out(u: User) -> MemberOut:
    role = u.role_names[0] if u.role_names else "PUBLISHER"
    return MemberOut(
        id=u.id, first_name=u.first_name, last_name=u.last_name, full_name=u.full_name, email=u.email,
        role=role, status=u.status, created_at=u.created_at, invite_accepted_at=u.invite_accepted_at,
    )


def _get_member(db: Session, member_id: str) -> User:
    user = db.get(User, member_id)
    if not user or user.deleted_at is not None:
        raise _err("MEMBER_NOT_FOUND", "Team member not found", status.HTTP_404_NOT_FOUND)
    return user


def _set_role(db: Session, user: User, role_name: RoleName) -> None:
    role = db.scalar(select(Role).where(Role.name == role_name))
    if not role:
        role = Role(name=role_name, description=ROLE_INFO[role_name.value]["description"])
        db.add(role)
        db.flush()
    for ur in list(user.user_roles):
        db.delete(ur)
    db.flush()
    db.add(UserRole(user_id=user.id, role_id=role.id))


def _active_admin_count(db: Session) -> int:
    admins = db.scalars(select(User).where(User.deleted_at.is_(None), User.is_active.is_(True))).all()
    return sum(1 for u in admins if "ADMIN" in u.role_names)


def _guard_last_admin(db: Session, user: User) -> None:
    if "ADMIN" in user.role_names and user.is_active and _active_admin_count(db) <= 1:
        raise _err("LAST_ADMIN", "There must be at least one active Admin")


def public_base_url(request: Request) -> str:
    """Where the app is being served from: the browser's origin (so links follow
    wherever it is hosted), falling back to the FRONTEND_URL setting."""
    for header in ("origin", "referer"):
        value = request.headers.get(header)
        if value:
            parsed = urlparse(value)
            if parsed.scheme in ("http", "https") and parsed.netloc:
                return f"{parsed.scheme}://{parsed.netloc}"
    return settings.FRONTEND_URL.rstrip("/")


def _send_invite(db: Session, user: User, inviter: User, base_url: str) -> str | None:
    """(Re)issue the invite token + default password and email the member.
    Returns an error message if the email could not be sent."""
    token = secrets.token_urlsafe(32)
    user.invite_token_hash = hashlib.sha256(token.encode()).hexdigest()
    user.invite_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.INVITE_EXPIRE_DAYS)
    user.invite_accepted_at = None
    user.hashed_password = hash_password(settings.DEFAULT_USER_PASSWORD)
    user.must_change_password = True
    db.commit()

    role_label = ROLE_INFO[user.role_names[0]]["label"]
    inviter_name = inviter.first_name or inviter.full_name
    ctx = {
        "first_name": user.first_name or user.full_name,
        "inviter": inviter_name,
        "role": role_label,
        "organization": get_org_name(db) or f"{inviter_name}'s Workspace",
        "email": user.email,
        "password": settings.DEFAULT_USER_PASSWORD,
        "expiry_days": settings.INVITE_EXPIRE_DAYS,
        "brand": get_template(db).brand_name,
        "year": datetime.now().year,
    }
    link = f"{base_url}/accept-invite?token={token}"
    subject, html, text, inline = render_invite(template_to_dict(get_template(db)), ctx, link, embed_logo=False)
    try:
        send_email(user.email, subject, html, text, inline)
    except EmailError as exc:
        return str(exc)
    return None


@router.get("/roles")
def list_roles():
    return [{"value": k, **v} for k, v in ROLE_INFO.items()]


@router.get("/members", response_model=list[MemberOut])
def list_members(db: Session = Depends(get_db)):
    users = db.scalars(select(User).where(User.deleted_at.is_(None)).order_by(User.created_at.asc())).all()
    return [_member_out(u) for u in users]


@router.post("/invite", response_model=InviteResult, status_code=status.HTTP_201_CREATED)
def invite_member(payload: InviteRequest, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    email = payload.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise _err("EMAIL_EXISTS", "A team member with this email already exists", status.HTTP_409_CONFLICT)
    first, last = payload.first_name.strip(), payload.last_name.strip()
    user = User(
        email=email, first_name=first, last_name=last, full_name=f"{first} {last}",
        hashed_password=hash_password(settings.DEFAULT_USER_PASSWORD), must_change_password=True, invited_by=current_user.id,
    )
    db.add(user)
    db.flush()
    _set_role(db, user, payload.role)
    db.commit()
    db.refresh(user)
    record_audit(db, current_user.id, AuditAction.USER_CREATED, "User", user.id)
    db.commit()
    error = _send_invite(db, user, current_user, public_base_url(request))
    db.refresh(user)
    return InviteResult(member=_member_out(user), email_sent=error is None, email_error=error)


@router.post("/members/{member_id}/resend", response_model=InviteResult)
def resend_invite(member_id: str, request: Request, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = _get_member(db, member_id)
    if user.status == "ACTIVE" and user.invite_accepted_at and not user.must_change_password:
        raise _err("ALREADY_ACTIVE", "This member has already set up their account")
    error = _send_invite(db, user, current_user, public_base_url(request))
    db.refresh(user)
    return InviteResult(member=_member_out(user), email_sent=error is None, email_error=error)


@router.put("/members/{member_id}", response_model=MemberOut)
def update_member(member_id: str, payload: MemberUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = _get_member(db, member_id)
    if payload.role.value not in user.role_names:
        if user.id == current_user.id:
            raise _err("SELF_ROLE_CHANGE", "You can't change your own role")
        _guard_last_admin(db, user)
        _set_role(db, user, payload.role)
    user.first_name, user.last_name = payload.first_name.strip(), payload.last_name.strip()
    user.full_name = f"{user.first_name} {user.last_name}"
    db.commit()
    record_audit(db, current_user.id, AuditAction.USER_UPDATED, "User", user.id)
    db.commit()
    db.refresh(user)
    return _member_out(user)


@router.post("/members/{member_id}/disable", response_model=MemberOut)
def disable_member(member_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = _get_member(db, member_id)
    if user.id == current_user.id:
        raise _err("SELF_DISABLE", "You can't disable your own account")
    _guard_last_admin(db, user)
    user.is_active = False
    db.commit()
    db.refresh(user)
    return _member_out(user)


@router.post("/members/{member_id}/enable", response_model=MemberOut)
def enable_member(member_id: str, db: Session = Depends(get_db)):
    user = _get_member(db, member_id)
    user.is_active = True
    db.commit()
    db.refresh(user)
    return _member_out(user)


@router.delete("/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = _get_member(db, member_id)
    if user.id == current_user.id:
        raise _err("SELF_DELETE", "You can't delete your own account")
    _guard_last_admin(db, user)
    user.deleted_at = datetime.now(timezone.utc)
    user.is_active = False
    user.invite_token_hash = None
    user.email = f"{user.email}.deleted.{user.id[:8]}"  # frees the address for a future invite
    record_audit(db, current_user.id, AuditAction.USER_DELETED, "User", user.id)
    db.commit()
