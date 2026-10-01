from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.db.session import get_db
from app.core.config import get_settings
from app.core.deps import get_current_user, require_roles
from app.core.security import encrypt_secret, decrypt_secret
from app.models.social import SocialAccount, SocialAccountToken
from app.models.user import User
from app.models.enums import Platform, RoleName, SocialAccountStatus, TokenStatus, AuditAction
from app.schemas.social_account import SocialAccountOut, ConnectRequest, AuthorizeUrlOut, TestConnectionOut
from app.services.social import get_social_provider, MissingCredentialsError
from app.services.social.meta import meta_authorize_url, meta_connect
from app.services.platform_credentials import get_credentials
from app.services.audit import record_audit

router = APIRouter(prefix="/api/social-accounts", tags=["social-accounts"])
settings = get_settings()


def _validate_platform(platform: str) -> str:
    try:
        return Platform(platform.upper()).value
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_PLATFORM", "message": f"Unknown platform: {platform}"}},
        )


def _callback_redirect_uri(platform: str) -> str:
    return f"{settings.APP_URL}/api/social-accounts/{platform.lower()}/callback"


@router.get("", response_model=list[SocialAccountOut])
def list_social_accounts(db: Session = Depends(get_db), _=Depends(get_current_user)):
    accounts = db.scalars(
        select(SocialAccount).where(SocialAccount.deleted_at.is_(None)).order_by(SocialAccount.platform)
    ).all()
    return accounts


@router.get("/meta/authorize-url", response_model=AuthorizeUrlOut)
def get_meta_authorize_url(db: Session = Depends(get_db), _=Depends(require_roles(RoleName.ADMIN.value))):
    """Facebook and Instagram are one Meta login: this single flow connects
    both from one consent screen, instead of asking for Facebook approval
    twice."""
    if settings.DEMO_MODE:
        return AuthorizeUrlOut(authorize_url="", demo_mode=True, credentials_configured=True)
    credentials = get_credentials(db, "FACEBOOK")
    if not credentials:
        return AuthorizeUrlOut(authorize_url="", demo_mode=False, credentials_configured=False)
    client_id, _ = credentials
    url = meta_authorize_url(client_id, f"{settings.APP_URL}/api/social-accounts/meta/callback", state="META")
    return AuthorizeUrlOut(authorize_url=url, demo_mode=False, credentials_configured=True)


@router.get("/meta/callback")
def meta_oauth_callback(code: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    """One Facebook consent screen; connects every Facebook Page the user
    manages, plus (for any Page that has one linked) its Instagram Business
    account."""
    settings_url = f"{settings.FRONTEND_URL}/settings/social-accounts"
    if error or not code:
        return RedirectResponse(f"{settings_url}?error={error or 'access_denied'}")

    credentials = get_credentials(db, "FACEBOOK")
    if not credentials:
        return RedirectResponse(f"{settings_url}?error=missing_credentials")
    client_id, client_secret = credentials

    try:
        results = meta_connect(client_id, client_secret, code, f"{settings.APP_URL}/api/social-accounts/meta/callback")
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(f"{settings_url}?error={str(exc)[:200]}")

    for platform, connect_results in results.items():
        for result in connect_results:
            _upsert_account(
                db, platform, result.external_account_id, result.account_name, result.access_token, result.refresh_token, result.expires_at, connected_by=None
            )
    return RedirectResponse(f"{settings_url}?connected=META")


@router.get("/{platform}/authorize-url", response_model=AuthorizeUrlOut)
def get_authorize_url(platform: str, db: Session = Depends(get_db), _=Depends(require_roles(RoleName.ADMIN.value))):
    platform = _validate_platform(platform)
    if settings.DEMO_MODE:
        return AuthorizeUrlOut(authorize_url="", demo_mode=True, credentials_configured=True)
    try:
        provider = get_social_provider(platform, db)
    except MissingCredentialsError:
        return AuthorizeUrlOut(authorize_url="", demo_mode=False, credentials_configured=False)
    url = provider.authorize_url(_callback_redirect_uri(platform), state=platform)
    return AuthorizeUrlOut(authorize_url=url, demo_mode=False, credentials_configured=True)


@router.get("/{platform}/callback")
def oauth_callback(platform: str, code: str | None = None, error: str | None = None, db: Session = Depends(get_db)):
    """The browser lands here after the user approves (or denies) access on
    the platform's consent screen. Exchanges the code, stores the encrypted
    token, then redirects back to the Settings page."""
    platform = _validate_platform(platform)
    settings_url = f"{settings.FRONTEND_URL}/settings/social-accounts"

    if error or not code:
        return RedirectResponse(f"{settings_url}?error={error or 'access_denied'}")

    provider = get_social_provider(platform, db)
    try:
        result = provider.connect(code, _callback_redirect_uri(platform))
    except Exception as exc:  # noqa: BLE001
        return RedirectResponse(f"{settings_url}?error={str(exc)[:200]}")

    _upsert_account(db, platform, result.external_account_id, result.account_name, result.access_token, result.refresh_token, result.expires_at, connected_by=None)
    return RedirectResponse(f"{settings_url}?connected={platform}")


def _upsert_account(
    db: Session,
    platform: str,
    external_account_id: str,
    account_name: str,
    access_token: str,
    refresh_token: str | None,
    expires_at,
    connected_by: str | None,
) -> SocialAccount:
    account = db.scalar(
        select(SocialAccount).where(
            SocialAccount.platform == platform,
            SocialAccount.external_account_id == external_account_id,
            SocialAccount.deleted_at.is_(None),
        )
    )
    if not account:
        account = SocialAccount(platform=platform, account_name=account_name, external_account_id=external_account_id)
        db.add(account)
        db.flush()

    account.account_name = account_name
    account.external_account_id = external_account_id
    account.status = SocialAccountStatus.CONNECTED
    account.last_sync_at = datetime.now(timezone.utc)
    account.connected_by = connected_by

    if account.token:
        account.token.encrypted_access_token = encrypt_secret(access_token)
        account.token.encrypted_refresh_token = encrypt_secret(refresh_token) if refresh_token else None
        account.token.token_status = TokenStatus.VALID
        account.token.expires_at = expires_at
    else:
        db.add(
            SocialAccountToken(
                social_account_id=account.id,
                encrypted_access_token=encrypt_secret(access_token),
                encrypted_refresh_token=encrypt_secret(refresh_token) if refresh_token else None,
                token_status=TokenStatus.VALID,
                expires_at=expires_at,
            )
        )

    db.commit()
    db.refresh(account)
    return account


@router.post(
    "/meta/connect",
    response_model=list[SocialAccountOut],
    dependencies=[Depends(require_roles(RoleName.ADMIN.value))],
)
def connect_demo_meta(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """DEMO_MODE-only shortcut mirroring the real /meta/callback flow: connects
    both Facebook and Instagram from one click."""
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {"code": "USE_OAUTH_FLOW", "message": "DEMO_MODE is off — connect via GET /meta/authorize-url instead."},
            },
        )
    accounts = []
    for platform in ("FACEBOOK", "INSTAGRAM"):
        provider = get_social_provider(platform, db)
        result = provider.connect("", "")
        account = _upsert_account(
            db, platform, result.external_account_id, result.account_name, result.access_token, result.refresh_token, result.expires_at, current_user.id
        )
        record_audit(db, current_user.id, AuditAction.SOCIAL_ACCOUNT_CONNECTED, "SocialAccount", account.id, metadata={"platform": platform})
        accounts.append(account)
    return accounts


@router.post(
    "/{platform}/connect",
    response_model=SocialAccountOut,
    dependencies=[Depends(require_roles(RoleName.ADMIN.value))],
)
def connect_demo_account(
    platform: str,
    payload: ConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """DEMO_MODE-only shortcut: connects instantly without a real OAuth round
    trip, so the full workflow (connect -> publish) is testable with zero
    external credentials. In live mode, use the /authorize-url + /callback
    flow instead."""
    platform = _validate_platform(platform)
    if not settings.DEMO_MODE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "USE_OAUTH_FLOW",
                    "message": "DEMO_MODE is off — connect via the real OAuth flow (GET /authorize-url) instead.",
                },
            },
        )
    provider = get_social_provider(platform, db)
    result = provider.connect(payload.auth_code or "", _callback_redirect_uri(platform))
    account = _upsert_account(
        db, platform, result.external_account_id, result.account_name, result.access_token, result.refresh_token, result.expires_at, current_user.id
    )
    record_audit(db, current_user.id, AuditAction.SOCIAL_ACCOUNT_CONNECTED, "SocialAccount", account.id, metadata={"platform": platform})
    return account


def _get_account_or_404(db: Session, account_id: str) -> SocialAccount:
    account = db.scalar(
        select(SocialAccount)
        .options(selectinload(SocialAccount.token))
        .where(SocialAccount.id == account_id, SocialAccount.deleted_at.is_(None))
    )
    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "ACCOUNT_NOT_FOUND", "message": "Social account not found"}},
        )
    return account


@router.post(
    "/accounts/{account_id}/test",
    response_model=TestConnectionOut,
    dependencies=[Depends(require_roles(RoleName.ADMIN.value))],
)
def test_connection(account_id: str, db: Session = Depends(get_db)):
    account = _get_account_or_404(db, account_id)
    if not account.token:
        return TestConnectionOut(platform=account.platform.value, connected=False, message="No token stored for this account")

    provider = get_social_provider(account.platform.value, db)
    try:
        access_token = decrypt_secret(account.token.encrypted_access_token)
    except Exception:  # noqa: BLE001 - token was encrypted with a different TOKEN_ENCRYPTION_KEY
        account.status = SocialAccountStatus.ERROR
        db.commit()
        return TestConnectionOut(
            platform=account.platform.value,
            connected=False,
            message="The saved token can't be read (the encryption key changed). Click Reconnect to authorize again.",
        )
    try:
        ok = provider.validate_connection(access_token, account.external_account_id)
    except Exception as exc:  # noqa: BLE001
        account.status = SocialAccountStatus.ERROR
        db.commit()
        return TestConnectionOut(platform=account.platform.value, connected=False, message=str(exc))

    account.status = SocialAccountStatus.CONNECTED if ok else SocialAccountStatus.ERROR
    account.last_sync_at = datetime.now(timezone.utc)
    db.commit()
    return TestConnectionOut(
        platform=account.platform.value,
        connected=ok,
        message="Connection is healthy" if ok else "Connection could not be validated",
    )


@router.post(
    "/accounts/{account_id}/disconnect",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(RoleName.ADMIN.value))],
)
def disconnect_account(account_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    account = _get_account_or_404(db, account_id)

    if account.token:
        provider = get_social_provider(account.platform.value, db)
        try:
            provider.disconnect(decrypt_secret(account.token.encrypted_access_token), account.external_account_id)
        except Exception:
            pass  # best-effort revoke; local disconnect proceeds regardless

    account.status = SocialAccountStatus.DISCONNECTED
    account.deleted_at = datetime.now(timezone.utc)
    db.commit()
    record_audit(db, current_user.id, AuditAction.SOCIAL_ACCOUNT_DISCONNECTED, "SocialAccount", account.id, metadata={"platform": account.platform.value})
