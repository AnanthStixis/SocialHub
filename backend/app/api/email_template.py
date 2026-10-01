import uuid
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.deps import get_current_user, require_roles
from app.db.session import get_db
from app.models.enums import RoleName
from app.models.user import User
from app.services.email import EmailError, send_email
from app.api.team import public_base_url
from app.services.organization import get_org_name
from app.services.invite_email import DEFAULTS, PLACEHOLDERS, UPLOAD_DIR, get_template, render_invite, template_to_dict

router = APIRouter(
    prefix="/api/email-template", tags=["email-template"], dependencies=[Depends(require_roles(RoleName.ADMIN.value))]
)
settings = get_settings()

ALLOWED_LOGO_TYPES = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "image/gif": ".gif"}
MAX_LOGO_BYTES = 2 * 1024 * 1024


class TemplateIn(BaseModel):
    brand_name: str = Field(min_length=1, max_length=100)
    accent_color: str = Field(default="#0f766e", max_length=20)
    subject: str = Field(min_length=1, max_length=255)
    heading: str = Field(min_length=1, max_length=255)
    intro: str = Field(min_length=1, max_length=2000)
    bullets: list[str] = Field(default_factory=list, max_length=6)
    instructions: str = Field(max_length=2000)
    button_text: str = Field(min_length=1, max_length=100)
    expiry_note: str = Field(max_length=255)
    footer: str = Field(max_length=255)


def _bad(code: str, message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"success": False, "error": {"code": code, "message": message}})


def _sample_ctx(user: User, org: str | None = None) -> dict:
    name = user.first_name or user.full_name
    return {
        "first_name": "Alex", "inviter": name, "role": "Publisher", "organization": org or f"{name}'s Workspace",
        "email": "alex@example.com", "password": settings.DEFAULT_USER_PASSWORD,
        "expiry_days": settings.INVITE_EXPIRE_DAYS, "brand": "", "year": datetime.now().year,
    }


def _render(tpl: dict, user: User, embed: bool, base_url: str, org: str | None = None):
    ctx = _sample_ctx(user, org)
    ctx["brand"] = tpl["brand_name"]
    return render_invite(tpl, ctx, f"{base_url}/accept-invite?token=sample-token", embed_logo=embed)


@router.get("")
def read_template(db: Session = Depends(get_db)):
    return {**template_to_dict(get_template(db)), "placeholders": PLACEHOLDERS, "defaults": DEFAULTS}


@router.put("")
def save_template(payload: TemplateIn, db: Session = Depends(get_db)):
    tpl = get_template(db)
    for k, v in payload.model_dump().items():
        setattr(tpl, k, v)
    db.commit()
    return template_to_dict(tpl)


@router.post("/logo")
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    ext = ALLOWED_LOGO_TYPES.get(file.content_type or "")
    if not ext:
        raise _bad("UNSUPPORTED_LOGO", "Logo must be a PNG, JPG, WEBP or GIF image")
    data = await file.read()
    if len(data) > MAX_LOGO_BYTES:
        raise _bad("LOGO_TOO_LARGE", "Logo must be 2 MB or smaller")
    tpl = get_template(db)
    _remove_logo_file(tpl.logo_file)
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    tpl.logo_file = name
    db.commit()
    return template_to_dict(tpl)


def _remove_logo_file(name: str | None) -> None:
    if name:
        (UPLOAD_DIR / Path(name).name).unlink(missing_ok=True)


@router.delete("/logo")
def delete_logo(db: Session = Depends(get_db)):
    tpl = get_template(db)
    _remove_logo_file(tpl.logo_file)
    tpl.logo_file = None
    db.commit()
    return template_to_dict(tpl)


@router.post("/preview")
def preview(payload: TemplateIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """Render the (possibly unsaved) draft so the editor can show it live."""
    tpl = {**payload.model_dump(), "logo_file": get_template(db).logo_file}
    subject, html, _, _ = _render(tpl, user, embed=True, base_url=public_base_url(request), org=get_org_name(db))
    return {"subject": subject, "html": html}


@router.post("/test")
def send_test(payload: TemplateIn, request: Request, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    tpl = {**payload.model_dump(), "logo_file": get_template(db).logo_file}
    subject, html, text, inline = _render(tpl, user, embed=False, base_url=public_base_url(request), org=get_org_name(db))
    try:
        send_email(user.email, f"[Test] {subject}", html, text, inline)
    except EmailError as exc:
        raise _bad("EMAIL_FAILED", str(exc))
    return {"sent_to": user.email}
