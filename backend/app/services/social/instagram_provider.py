import time
import httpx
from urllib.parse import urlencode
from app.services.social.base import SocialMediaProvider, PublishResult, AccountInfo, ConnectResult, Engagement

GRAPH_API_VERSION = "v19.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class InstagramProvider(SocialMediaProvider):
    """Instagram publishing via the Instagram Graph API, which is reached
    through a connected Facebook Page's linked Instagram Business Account.
    Image/video posts only (the Graph API has no plain-text-only post type).
    Not exercised against the live API in this environment (no Meta app
    credentials available) — DemoSocialProvider covers the workflow until
    real credentials are supplied."""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    def authorize_url(self, redirect_uri: str, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "instagram_basic,instagram_content_publish,pages_show_list",
            "response_type": "code",
        }
        return f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth?{urlencode(params)}"

    def connect(self, auth_code: str, redirect_uri: str) -> ConnectResult:
        token_resp = httpx.get(
            f"{GRAPH_BASE}/oauth/access_token",
            params={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "redirect_uri": redirect_uri,
                "code": auth_code,
            },
            timeout=30.0,
        )
        token_resp.raise_for_status()
        user_token = token_resp.json()["access_token"]

        pages_resp = httpx.get(
            f"{GRAPH_BASE}/me/accounts",
            params={"fields": "instagram_business_account,name,access_token", "access_token": user_token},
            timeout=30.0,
        )
        pages_resp.raise_for_status()
        pages = pages_resp.json().get("data", [])
        page_with_ig = next((p for p in pages if p.get("instagram_business_account")), None)
        if not page_with_ig:
            raise ValueError("No Instagram Business Account linked to any of this user's Facebook Pages")

        ig_account_id = page_with_ig["instagram_business_account"]["id"]
        page_token = page_with_ig["access_token"]

        account_resp = httpx.get(
            f"{GRAPH_BASE}/{ig_account_id}", params={"fields": "username", "access_token": page_token}, timeout=30.0
        )
        account_resp.raise_for_status()
        username = account_resp.json().get("username", ig_account_id)

        return ConnectResult(
            external_account_id=ig_account_id,
            account_name=f"@{username}",
            access_token=page_token,
            refresh_token=None,
            expires_at=None,
        )

    def disconnect(self, access_token: str, external_account_id: str) -> None:
        return None  # Instagram has no per-account disconnect call; revoke via Facebook Page permissions.

    def validate_connection(self, access_token: str, external_account_id: str) -> bool:
        resp = httpx.get(
            f"{GRAPH_BASE}/{external_account_id}", params={"fields": "id", "access_token": access_token}, timeout=30.0
        )
        return resp.status_code == 200

    def get_account(self, access_token: str) -> AccountInfo:
        resp = httpx.get(f"{GRAPH_BASE}/me", params={"access_token": access_token}, timeout=30.0)
        resp.raise_for_status()
        data = resp.json()
        return AccountInfo(external_account_id=data["id"], account_name=data.get("name", ""))

    def _publish_media(self, *, access_token: str, external_account_id: str, media_params: dict, caption: str) -> PublishResult:
        create_resp = httpx.post(
            f"{GRAPH_BASE}/{external_account_id}/media",
            data={**media_params, "caption": caption, "access_token": access_token},
            timeout=60.0,
        )
        if create_resp.status_code != 200:
            try:
                message = create_resp.json().get("error", {}).get("message", create_resp.text)
            except Exception:
                message = create_resp.text
            return PublishResult(success=False, error_message=message)

        creation_id = create_resp.json()["id"]

        # Instagram processes media asynchronously; poll briefly before publishing.
        for _ in range(5):
            status_resp = httpx.get(
                f"{GRAPH_BASE}/{creation_id}",
                params={"fields": "status_code", "access_token": access_token},
                timeout=30.0,
            )
            if status_resp.json().get("status_code") == "FINISHED":
                break
            time.sleep(2)

        publish_resp = httpx.post(
            f"{GRAPH_BASE}/{external_account_id}/media_publish",
            data={"creation_id": creation_id, "access_token": access_token},
            timeout=30.0,
        )
        if publish_resp.status_code == 200:
            return PublishResult(success=True, external_post_id=publish_resp.json().get("id"))
        try:
            message = publish_resp.json().get("error", {}).get("message", publish_resp.text)
        except Exception:
            message = publish_resp.text
        return PublishResult(success=False, error_message=message)

    def publish_text(self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str]) -> PublishResult:
        return PublishResult(
            success=False,
            error_message="Instagram requires an image or video — text-only posts are not supported by the platform.",
        )

    def publish_image(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], image_urls: list[str]
    ) -> PublishResult:
        caption = f"{content}\n\n{' '.join(hashtags)}".strip()
        return self._publish_media(
            access_token=access_token,
            external_account_id=external_account_id,
            media_params={"image_url": image_urls[0]},
            caption=caption,
        )

    def publish_video(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], video_url: str
    ) -> PublishResult:
        caption = f"{content}\n\n{' '.join(hashtags)}".strip()
        return self._publish_media(
            access_token=access_token,
            external_account_id=external_account_id,
            media_params={"video_url": video_url, "media_type": "REELS"},
            caption=caption,
        )

    def get_publishing_status(self, access_token: str, external_post_id: str) -> str:
        resp = httpx.get(
            f"{GRAPH_BASE}/{external_post_id}", params={"fields": "id", "access_token": access_token}, timeout=30.0
        )
        return "PUBLISHED" if resp.status_code == 200 else "FAILED"

    def get_engagement(self, access_token: str, external_post_id: str) -> Engagement:
        resp = httpx.get(
            f"{GRAPH_BASE}/{external_post_id}",
            params={"fields": "like_count,comments_count", "access_token": access_token},
            timeout=30.0,
        )
        if resp.status_code != 200:
            return Engagement()
        data = resp.json()
        return Engagement(likes=data.get("like_count", 0) or 0, comments=data.get("comments_count", 0) or 0)
