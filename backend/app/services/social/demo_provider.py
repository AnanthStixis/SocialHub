import random
import uuid
from app.services.social.base import SocialMediaProvider, PublishResult, AccountInfo, ConnectResult, Engagement


class DemoSocialProvider(SocialMediaProvider):
    """Simulates a successful connect/publish without calling any real API,
    so the full connect -> schedule -> publish workflow is testable with
    zero external credentials. Used automatically when DEMO_MODE=true."""

    def __init__(self, platform: str):
        self.platform = platform

    def authorize_url(self, redirect_uri: str, state: str) -> str:
        return f"about:blank#demo-{self.platform.lower()}-connect"

    def connect(self, auth_code: str, redirect_uri: str) -> ConnectResult:
        return ConnectResult(
            external_account_id=f"demo-{self.platform.lower()}-{uuid.uuid4().hex[:8]}",
            account_name=f"Demo {self.platform.title()} Account",
            access_token=f"demo_token_{uuid.uuid4().hex}",
            refresh_token=None,
            expires_at=None,
        )

    def disconnect(self, access_token: str, external_account_id: str) -> None:
        return None

    def validate_connection(self, access_token: str, external_account_id: str) -> bool:
        return True

    def get_account(self, access_token: str) -> AccountInfo:
        return AccountInfo(external_account_id="demo-account", account_name=f"Demo {self.platform.title()} Account")

    def _fake_publish(self) -> PublishResult:
        return PublishResult(success=True, external_post_id=f"demo_{self.platform.lower()}_{uuid.uuid4().hex[:12]}")

    def publish_text(self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str]) -> PublishResult:
        return self._fake_publish()

    def publish_image(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], image_urls: list[str]
    ) -> PublishResult:
        return self._fake_publish()

    def publish_video(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], video_url: str
    ) -> PublishResult:
        return self._fake_publish()

    def get_publishing_status(self, access_token: str, external_post_id: str) -> str:
        return "PUBLISHED"

    def get_engagement(self, access_token: str, external_post_id: str) -> Engagement:
        rng = random.Random(external_post_id)
        return Engagement(likes=rng.randint(5, 250), comments=rng.randint(0, 40))
