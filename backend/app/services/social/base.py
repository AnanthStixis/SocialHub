from abc import ABC, abstractmethod
from datetime import datetime
from pydantic import BaseModel


class PublishResult(BaseModel):
    success: bool
    external_post_id: str | None = None
    error_message: str | None = None


class Engagement(BaseModel):
    likes: int = 0
    comments: int = 0


class AccountInfo(BaseModel):
    external_account_id: str
    account_name: str


class ConnectResult(BaseModel):
    external_account_id: str
    account_name: str
    access_token: str
    refresh_token: str | None = None
    expires_at: datetime | None = None


class SocialMediaProvider(ABC):
    """Common interface every platform integration implements, so adding a
    new platform (X/Twitter, YouTube, Threads, TikTok, Pinterest, ...) never
    touches the publishing engine, OAuth flow, or the API layer.

    Providers are stateless: every call takes the access token it needs,
    mirroring how the real Graph/REST APIs work (a token per request, not a
    persistent connection)."""

    @abstractmethod
    def authorize_url(self, redirect_uri: str, state: str) -> str:
        """Build the URL the browser is sent to start the OAuth consent flow."""
        ...

    @abstractmethod
    def connect(self, auth_code: str, redirect_uri: str) -> ConnectResult:
        """Exchange an OAuth authorization code for a long-lived access token."""
        ...

    @abstractmethod
    def disconnect(self, access_token: str, external_account_id: str) -> None: ...

    @abstractmethod
    def validate_connection(self, access_token: str, external_account_id: str) -> bool: ...

    @abstractmethod
    def get_account(self, access_token: str) -> AccountInfo: ...

    @abstractmethod
    def publish_text(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str]
    ) -> PublishResult: ...

    @abstractmethod
    def publish_image(
        self,
        *,
        access_token: str,
        external_account_id: str,
        content: str,
        hashtags: list[str],
        image_urls: list[str],
    ) -> PublishResult: ...

    @abstractmethod
    def publish_video(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], video_url: str
    ) -> PublishResult: ...

    @abstractmethod
    def get_publishing_status(self, access_token: str, external_post_id: str) -> str: ...

    def get_engagement(self, access_token: str, external_post_id: str) -> Engagement:
        """Current like/comment counts for a published post. Platforms that
        don't expose them return zeros."""
        return Engagement()
