from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.services.social.base import SocialMediaProvider, PublishResult, AccountInfo, ConnectResult
from app.services.social.demo_provider import DemoSocialProvider
from app.services.platform_credentials import get_credentials

settings = get_settings()

_REAL_PROVIDER_CLASSES = {}


def _load_real_provider_classes():
    # Imported lazily so importing this package never requires httpx to be
    # exercised or fails if a provider module has an unrelated issue.
    if not _REAL_PROVIDER_CLASSES:
        from app.services.social.facebook_provider import FacebookProvider
        from app.services.social.instagram_provider import InstagramProvider
        from app.services.social.linkedin_provider import LinkedInProvider

        _REAL_PROVIDER_CLASSES.update(
            {
                "FACEBOOK": FacebookProvider,
                "INSTAGRAM": InstagramProvider,
                "LINKEDIN": LinkedInProvider,
            }
        )
    return _REAL_PROVIDER_CLASSES


class MissingCredentialsError(Exception):
    def __init__(self, platform: str):
        self.platform = platform
        super().__init__(
            f"No app credentials configured for {platform}. Add them in Settings -> Platform Apps before connecting."
        )


def get_social_provider(platform: str, db: Session | None = None) -> SocialMediaProvider:
    if settings.DEMO_MODE:
        return DemoSocialProvider(platform)

    provider_classes = _load_real_provider_classes()
    provider_cls = provider_classes.get(platform)
    if not provider_cls:
        raise NotImplementedError(
            f"No live provider implemented for {platform} yet. Future platforms (X/Twitter, YouTube, "
            "Threads, TikTok, Pinterest) plug in here without touching the publishing engine."
        )

    if db is None:
        raise ValueError("A database session is required to resolve live platform credentials")

    credentials = get_credentials(db, platform)
    if not credentials:
        raise MissingCredentialsError(platform)

    client_id, client_secret = credentials
    return provider_cls(client_id, client_secret)


__all__ = [
    "SocialMediaProvider",
    "PublishResult",
    "AccountInfo",
    "ConnectResult",
    "MissingCredentialsError",
    "get_social_provider",
]
