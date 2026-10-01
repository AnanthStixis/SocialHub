import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from app.core.config import get_settings

settings = get_settings()


class EmailError(Exception):
    pass


def smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.EMAIL_FROM)


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str,
    inline_images: dict[str, tuple[bytes, str]] | None = None,
) -> None:
    """Send a multipart (text + HTML) email. `inline_images` maps a Content-ID
    to (bytes, mime_type) and is referenced in the HTML as cid:<id>."""
    if not smtp_configured():
        raise EmailError("SMTP is not configured. Set SMTP_HOST and EMAIL_FROM in .env.")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.EMAIL_FROM_NAME, settings.EMAIL_FROM))
    msg["To"] = to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    html_part = msg.get_payload()[1]
    for cid, (data, mime) in (inline_images or {}).items():
        maintype, _, subtype = mime.partition("/")
        html_part.add_related(data, maintype=maintype, subtype=subtype, cid=f"<{cid}>", disposition="inline")

    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20, context=ssl.create_default_context())
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
        with server:
            if settings.SMTP_PORT != 465 and settings.SMTP_TLS:
                server.starttls(context=ssl.create_default_context())
            if settings.SMTP_USER:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
    except (smtplib.SMTPException, OSError) as exc:
        raise EmailError(f"Could not send email: {exc}") from exc
