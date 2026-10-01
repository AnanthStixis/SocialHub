from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.security import encrypt_secret, decrypt_secret
from app.models.system import SystemSetting

settings = get_settings()

_ENV_FALLBACK = {
    "FACEBOOK": ("FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"),
    "INSTAGRAM": ("INSTAGRAM_CLIENT_ID", "INSTAGRAM_CLIENT_SECRET"),
    "LINKEDIN": ("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"),
}


def _key(platform: str) -> str:
    return f"platform_oauth_app::{platform}"


def get_credentials(db: Session, platform: str) -> tuple[str, str] | None:
    """Client ID/secret for a platform's OAuth app. Prefers what the admin
    entered in Settings -> Platform Apps (encrypted in system_settings) over
    .env, so nobody has to hand-edit environment files. Falls back to .env
    (or, for Instagram, to the Facebook app) so an existing deployment's env
    vars keep working."""
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _key(platform)))
    if row and row.value.get("client_id") and row.value.get("encrypted_client_secret"):
        return row.value["client_id"], decrypt_secret(row.value["encrypted_client_secret"])

    if platform == "INSTAGRAM":
        # Instagram Business accounts are managed through the same Meta app
        # as Facebook Pages, so Instagram never needs its own client
        # id/secret -- reuse whatever was entered (UI or .env) for Facebook.
        facebook_creds = get_credentials(db, "FACEBOOK")
        if facebook_creds:
            return facebook_creds

    env_client_id_field, env_secret_field = _ENV_FALLBACK[platform]
    client_id = getattr(settings, env_client_id_field, "")
    client_secret = getattr(settings, env_secret_field, "")
    if client_id and client_secret:
        return client_id, client_secret
    return None


def set_credentials(db: Session, platform: str, client_id: str, client_secret: str) -> None:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _key(platform)))
    value = {"client_id": client_id, "encrypted_client_secret": encrypt_secret(client_secret)}
    if row:
        row.value = value
    else:
        db.add(SystemSetting(key=_key(platform), value=value, description=f"OAuth app credentials for {platform}"))
    db.commit()


def clear_credentials(db: Session, platform: str) -> None:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _key(platform)))
    if row:
        db.delete(row)
        db.commit()


def credentials_status(db: Session, platform: str) -> dict:
    row = db.scalar(select(SystemSetting).where(SystemSetting.key == _key(platform)))
    if row and row.value.get("client_id"):
        client_id = row.value["client_id"]
        return {
            "platform": platform,
            "configured": True,
            "source": "settings",
            "client_id_preview": client_id[:6] + "..." if len(client_id) > 6 else client_id,
        }

    creds = get_credentials(db, platform)
    if creds:
        return {
            "platform": platform,
            "configured": True,
            "source": "facebook_app" if platform == "INSTAGRAM" else "env",
            "client_id_preview": creds[0][:6] + "..." if len(creds[0]) > 6 else creds[0],
        }

    return {"platform": platform, "configured": False, "source": "none", "client_id_preview": None}
