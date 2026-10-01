import base64
import mimetypes
from html import escape
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.system import EmailTemplate

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads" / "email"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DEFAULTS = dict(
    brand_name="Feedwren",
    accent_color="#0f766e",
    subject="You're invited to join {{organization}} on {{brand}}",
    heading="You're invited to {{organization}}",
    intro="{{inviter}} invited you to join as {{role_article}} {{role}}.",
    bullets=["Schedule posts across platforms", "Collaborate with your team", "Track performance"],
    instructions=(
        "Sign in with the temporary password above. You'll be asked to choose a new password the first time you log in. "
        "Please don't share this password with anyone."
    ),
    button_text="Accept invitation",
    expiry_note="This invitation expires in {{expiry_days}} days.",
    footer="© {{year}} {{brand}} · All rights reserved",
)

PLACEHOLDERS = ["first_name", "inviter", "role", "organization", "email", "password", "expiry_days", "brand", "year"]


def get_template(db: Session) -> EmailTemplate:
    tpl = db.scalar(select(EmailTemplate))
    if not tpl:
        tpl = EmailTemplate(**DEFAULTS)
        db.add(tpl)
        db.commit()
        db.refresh(tpl)
    return tpl


def template_to_dict(tpl) -> dict:
    return {k: getattr(tpl, k) for k in DEFAULTS} | {"logo_file": getattr(tpl, "logo_file", None)}


def _fill(text: str, ctx: dict) -> str:
    for k, v in ctx.items():
        text = text.replace("{{" + k + "}}", str(v))
    return text


def logo_bytes(logo_file: str | None) -> tuple[bytes, str] | None:
    if not logo_file:
        return None
    path = UPLOAD_DIR / Path(logo_file).name
    if not path.is_file():
        return None
    return path.read_bytes(), mimetypes.guess_type(path.name)[0] or "image/png"


def render_invite(tpl: dict, ctx: dict, link: str, *, embed_logo: bool) -> tuple[str, str, str, dict]:
    """Returns (subject, html, text, inline_images). With embed_logo the logo is
    a data: URI (browser preview); otherwise a cid: reference for a real email."""
    ctx = dict(ctx)
    role = ctx["role"]
    ctx["role_article"] = "an" if role[:1].lower() in "aeiou" else "a"
    safe_ctx = {k: escape(str(v)) for k, v in ctx.items()}

    def raw(s: str) -> str:
        return _fill(s, ctx)

    def fill(s: str) -> str:
        return _fill(escape(s, quote=False), safe_ctx)

    color = str(tpl["accent_color"])
    accent = color if color.startswith("#") and len(color) in (4, 7) and color[1:].isalnum() else "#0f766e"
    brand = escape(tpl["brand_name"])
    inline: dict = {}
    logo = logo_bytes(tpl.get("logo_file"))
    logo_html = ""
    if logo:
        data, mime = logo
        if embed_logo:
            src = f"data:{mime};base64,{base64.b64encode(data).decode()}"
        else:
            src = "cid:brandlogo"
            inline["brandlogo"] = (data, mime)
        logo_html = f'<img src="{src}" alt="{brand}" width="120" style="display:block;margin:0 auto 12px;border-radius:24px;max-width:120px;height:auto">'
    brand_html = f'<div style="font-size:22px;font-weight:800;color:{accent};letter-spacing:-0.5px">{brand}</div>'
    bullets = "".join(
        f'<tr><td style="color:{accent};padding:4px 10px 4px 0;font-size:15px">&#10003;</td>'
        f'<td style="padding:4px 0;color:#4b5563;font-size:15px">{fill(b)}</td></tr>'
        for b in tpl["bullets"]
        if b.strip()
    )
    href = escape(link)

    html = f"""<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fff;border:1px solid #e5e7eb;border-radius:20px;overflow:hidden">
<tr><td align="center" style="padding:36px 24px 22px;border-bottom:1px solid #e5e7eb">{logo_html}{brand_html}</td></tr>
<tr><td style="padding:32px 36px 8px">
<h1 style="margin:0 0 8px;font-size:24px;color:#111827">{fill(tpl["heading"])}</h1>
<p style="margin:0 0 22px;font-size:15px;color:#4b5563">{fill(tpl["intro"])}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #bae6fd;border-radius:12px;margin-bottom:20px"><tr>
<td style="padding:14px 18px"><div style="font-size:13px;color:#6b7280">Organization</div><div style="font-size:16px;font-weight:700;color:#111827">{safe_ctx["organization"]}</div></td>
<td align="right" style="padding:14px 18px;font-size:13px;font-weight:700;color:#15803d">{safe_ctx["role"]}</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;margin-bottom:20px"><tr><td style="padding:14px 18px;font-size:14px;color:#374151">
<div style="font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#6b7280;margin-bottom:6px">Your sign-in details</div>
<div>Email: <b>{safe_ctx["email"]}</b></div><div>Temporary password: <b style="font-family:Consolas,monospace">{safe_ctx["password"]}</b></div></td></tr></table>
<p style="margin:0 0 18px;font-size:14px;color:#4b5563;line-height:1.5">{fill(tpl["instructions"])}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:18px">{bullets}</table>
<p style="margin:0 0 24px;font-size:14px;color:#4b5563">{fill(tpl["expiry_note"])}</p>
<div align="center" style="margin-bottom:24px"><a href="{href}" style="display:inline-block;background:{accent};color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 32px;border-radius:10px">{escape(tpl["button_text"])}</a></div>
<p style="margin:0 0 32px;font-size:12px;color:#6b7280;text-align:center;line-height:1.5">Button not working? <a href="{href}" style="color:{accent};word-break:break-all">{href}</a></p>
</td></tr></table>
<div style="padding:18px 0 0;text-align:center">{brand_html}<div style="font-size:12px;color:#6b7280;margin-top:4px">{fill(tpl["footer"])}</div></div>
</td></tr></table></body></html>"""

    text = "\n\n".join(
        [
            raw(tpl["heading"]),
            raw(tpl["intro"]),
            f"Organization: {ctx['organization']} ({ctx['role']})",
            f"Email: {ctx['email']}\nTemporary password: {ctx['password']}",
            raw(tpl["instructions"]),
            "\n".join(f"- {raw(b)}" for b in tpl["bullets"] if b.strip()),
            raw(tpl["expiry_note"]),
            f"{tpl['button_text']}: {link}",
            raw(tpl["footer"]),
        ]
    )
    return raw(tpl["subject"]), html, text, inline
