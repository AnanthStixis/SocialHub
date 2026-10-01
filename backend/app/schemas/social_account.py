from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SocialAccountOut(BaseModel):
    id: str
    platform: str
    account_name: str
    external_account_id: str
    status: str
    last_sync_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ConnectRequest(BaseModel):
    # Real OAuth mode: the authorization code returned by the platform's
    # consent redirect. Ignored in DEMO_MODE, where connecting is instant.
    auth_code: str | None = None


class AuthorizeUrlOut(BaseModel):
    authorize_url: str
    demo_mode: bool
    credentials_configured: bool = True


class TestConnectionOut(BaseModel):
    platform: str
    connected: bool
    message: str


class PlatformAppStatusOut(BaseModel):
    platform: str
    configured: bool
    source: str  # "settings" | "env" | "none"
    client_id_preview: str | None


class PlatformAppSaveRequest(BaseModel):
    client_id: str
    client_secret: str
