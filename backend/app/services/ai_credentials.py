from cryptography.fernet import InvalidToken
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.security import encrypt_secret, decrypt_secret
from app.models.system import SystemSetting

settings = get_settings()

_KEY = "ai_provider::openai"


class StoredKeyUnreadableError(Exception):
    """The stored API key can't be decrypted with the current TOKEN_ENCRYPTION_KEY."""


def get_openai_config(db: Session) -> tuple[str, str, str] | None:
    """(api_key, base_url, model). Prefers what the admin entered in
    Settings -> AI Provider (encrypted in system_settings) over .env, so
    nobody has to hand-edit environment files. Falls back to .env."""
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _KEY))
    if row and row.value.get("encrypted_api_key"):
        try:
            return (
                decrypt_secret(row.value["encrypted_api_key"]),
                row.value.get("base_url") or settings.OPENAI_BASE_URL,
                row.value.get("model") or settings.OPENAI_MODEL,
            )
        except InvalidToken:
            # Saved under a different TOKEN_ENCRYPTION_KEY; use .env if present, else ask for a re-save.
            if not settings.OPENAI_API_KEY:
                raise StoredKeyUnreadableError() from None
    if settings.OPENAI_API_KEY:
        return settings.OPENAI_API_KEY, settings.OPENAI_BASE_URL, settings.OPENAI_MODEL
    return None


def set_openai_config(db: Session, api_key: str, base_url: str | None, model: str | None) -> None:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _KEY))
    value = {
        "encrypted_api_key": encrypt_secret(api_key),
        "base_url": base_url or None,
        "model": model or None,
    }
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=_KEY, value=value, description="OpenAI-compatible API credentials"))
    db.commit()


def clear_openai_config(db: Session) -> None:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _KEY))
    if row:
        db.delete(row)
        db.commit()


def openai_status(db: Session) -> dict:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _KEY))
    if row and row.value.get("encrypted_api_key"):
        return {"configured": True, "source": "settings", "model": row.value.get("model") or settings.OPENAI_MODEL}
    if settings.OPENAI_API_KEY:
        return {"configured": True, "source": "env", "model": settings.OPENAI_MODEL}
    return {"configured": False, "source": "none", "model": None}
