import httpx
from urllib.parse import urlencode
from app.services.social.base import SocialMediaProvider, PublishResult, AccountInfo, ConnectResult, Engagement

GRAPH_API_VERSION = "v19.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class FacebookProvider(SocialMediaProvider):
    """Facebook Page publishing via the Graph API. Requires a Meta app's
    client ID/secret (entered once in Settings -> Platform Apps, or via
    FACEBOOK_CLIENT_ID/SECRET in .env) and a Page access token with
    pages_manage_posts permission. Not exercised against the live API in
    this environment (no Meta app credentials available) — DemoSocialProvider
    covers the workflow until real credentials are supplied."""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    def authorize_url(self, redirect_uri: str, state: str) -> str:
        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "pages_manage_posts,pages_read_engagement,pages_show_list",
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

        # Exchange for a long-lived token, then fetch the first manageable Page.
        long_lived_resp = httpx.get(
            f"{GRAPH_BASE}/oauth/access_token",
            params={
                "grant_type": "fb_exchange_token",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "fb_exchange_token": user_token,
            },
            timeout=30.0,
        )
        long_lived_resp.raise_for_status()
        long_lived_token = long_lived_resp.json()["access_token"]

        pages_resp = httpx.get(f"{GRAPH_BASE}/me/accounts", params={"access_token": long_lived_token}, timeout=30.0)
        pages_resp.raise_for_status()
        pages = pages_resp.json().get("data", [])
        if not pages:
            raise ValueError("No Facebook Pages available for this account")
        page = pages[0]

        return ConnectResult(
            external_account_id=page["id"],
            account_name=page["name"],
            access_token=page["access_token"],  # page-scoped token, used for publishing
            refresh_token=None,
            expires_at=None,
        )

    def disconnect(self, access_token: str, external_account_id: str) -> None:
        httpx.delete(f"{GRAPH_BASE}/{external_account_id}/permissions", params={"access_token": access_token}, timeout=30.0)

    def validate_connection(self, access_token: str, external_account_id: str) -> bool:
        resp = httpx.get(f"{GRAPH_BASE}/{external_account_id}", params={"access_token": access_token}, timeout=30.0)
        return resp.status_code == 200

    def get_account(self, access_token: str) -> AccountInfo:
        resp = httpx.get(f"{GRAPH_BASE}/me", params={"access_token": access_token}, timeout=30.0)
        resp.raise_for_status()
        data = resp.json()
        return AccountInfo(external_account_id=data["id"], account_name=data.get("name", ""))

    def _result_from_response(self, resp: httpx.Response) -> PublishResult:
        if resp.status_code == 200:
            return PublishResult(success=True, external_post_id=resp.json().get("id"))
        try:
            message = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            message = resp.text
        return PublishResult(success=False, error_message=message)

    def publish_text(self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str]) -> PublishResult:
        message = f"{content}\n\n{' '.join(hashtags)}".strip()
        resp = httpx.post(
            f"{GRAPH_BASE}/{external_account_id}/feed",
            data={"message": message, "access_token": access_token},
            timeout=30.0,
        )
        return self._result_from_response(resp)

    def publish_image(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], image_urls: list[str]
    ) -> PublishResult:
        message = f"{content}\n\n{' '.join(hashtags)}".strip()
        resp = httpx.post(
            f"{GRAPH_BASE}/{external_account_id}/photos",
            data={"url": image_urls[0], "caption": message, "access_token": access_token},
            timeout=30.0,
        )
        return self._result_from_response(resp)

    def publish_video(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], video_url: str
    ) -> PublishResult:
        message = f"{content}\n\n{' '.join(hashtags)}".strip()
        resp = httpx.post(
            f"{GRAPH_BASE}/{external_account_id}/videos",
            data={"file_url": video_url, "description": message, "access_token": access_token},
            timeout=60.0,
        )
        return self._result_from_response(resp)

    def get_publishing_status(self, access_token: str, external_post_id: str) -> str:
        resp = httpx.get(
            f"{GRAPH_BASE}/{external_post_id}", params={"fields": "id", "access_token": access_token}, timeout=30.0
        )
        return "PUBLISHED" if resp.status_code == 200 else "FAILED"

    def get_engagement(self, access_token: str, external_post_id: str) -> Engagement:
        resp = httpx.get(
            f"{GRAPH_BASE}/{external_post_id}",
            params={"fields": "likes.summary(true).limit(0),comments.summary(true).limit(0)", "access_token": access_token},
            timeout=30.0,
        )
        if resp.status_code != 200:
            return Engagement()
        data = resp.json()
        return Engagement(
            likes=data.get("likes", {}).get("summary", {}).get("total_count", 0),
            comments=data.get("comments", {}).get("summary", {}).get("total_count", 0),
        )
