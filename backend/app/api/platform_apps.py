from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import require_roles
from app.models.enums import Platform, RoleName
from app.schemas.social_account import PlatformAppStatusOut, PlatformAppSaveRequest
from app.services.platform_credentials import credentials_status, set_credentials, clear_credentials

router = APIRouter(prefix="/api/settings/platform-apps", tags=["platform-apps"])

MANAGED_PLATFORMS = ["FACEBOOK", "INSTAGRAM", "LINKEDIN"]


def _validate_platform(platform: str) -> str:
    try:
        value = Platform(platform.upper()).value
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_PLATFORM", "message": f"Unknown platform: {platform}"}},
        )
    if value not in MANAGED_PLATFORMS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "UNSUPPORTED_PLATFORM", "message": f"{value} has no OAuth app settings"}},
        )
    return value


@router.get("", response_model=list[PlatformAppStatusOut])
def list_platform_apps(db: Session = Depends(get_db), _=Depends(require_roles(RoleName.ADMIN.value))):
    return [credentials_status(db, p) for p in MANAGED_PLATFORMS]


@router.put(
    "/{platform}",
    response_model=PlatformAppStatusOut,
    dependencies=[Depends(require_roles(RoleName.ADMIN.value))],
)
def save_platform_app(platform: str, payload: PlatformAppSaveRequest, db: Session = Depends(get_db)):
    platform = _validate_platform(platform)
    set_credentials(db, platform, payload.client_id, payload.client_secret)
    return credentials_status(db, platform)


@router.delete(
    "/{platform}",
    response_model=PlatformAppStatusOut,
    dependencies=[Depends(require_roles(RoleName.ADMIN.value))],
)
def delete_platform_app(platform: str, db: Session = Depends(get_db)):
    platform = _validate_platform(platform)
    clear_credentials(db, platform)
    return credentials_status(db, platform)
