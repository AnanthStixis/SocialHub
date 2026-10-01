import httpx
from urllib.parse import urlencode
from app.services.social.base import SocialMediaProvider, PublishResult, AccountInfo, ConnectResult

LINKEDIN_API = "https://api.linkedin.com/v2"


class LinkedInProvider(SocialMediaProvider):
    """LinkedIn publishing via the UGC Posts API (v2). Not exercised against
    the live API in this environment (no LinkedIn app credentials available)
    — DemoSocialProvider covers the workflow until real credentials are
    supplied."""

    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret

    def authorize_url(self, redirect_uri: str, state: str) -> str:
        params = {
            "response_type": "code",
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "state": state,
            "scope": "openid profile w_member_social",
        }
        return f"https://www.linkedin.com/oauth/v2/authorization?{urlencode(params)}"

    def connect(self, auth_code: str, redirect_uri: str) -> ConnectResult:
        token_resp = httpx.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type": "authorization_code",
                "code": auth_code,
                "redirect_uri": redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30.0,
        )
        token_resp.raise_for_status()
        access_token = token_resp.json()["access_token"]

        profile_resp = httpx.get(
            f"{LINKEDIN_API}/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
        profile_resp.raise_for_status()
        profile = profile_resp.json()

        return ConnectResult(
            external_account_id=profile["sub"],
            account_name=profile.get("name", "LinkedIn Member"),
            access_token=access_token,
            refresh_token=None,
            expires_at=None,
        )

    def disconnect(self, access_token: str, external_account_id: str) -> None:
        return None  # LinkedIn tokens are revoked by the member from their account settings.

    def validate_connection(self, access_token: str, external_account_id: str) -> bool:
        resp = httpx.get(f"{LINKEDIN_API}/userinfo", headers={"Authorization": f"Bearer {access_token}"}, timeout=30.0)
        return resp.status_code == 200

    def get_account(self, access_token: str) -> AccountInfo:
        resp = httpx.get(f"{LINKEDIN_API}/userinfo", headers={"Authorization": f"Bearer {access_token}"}, timeout=30.0)
        resp.raise_for_status()
        data = resp.json()
        return AccountInfo(external_account_id=data["sub"], account_name=data.get("name", ""))

    def _upload_asset(self, *, access_token: str, author: str, asset_url: str, recipe: str) -> str:
        """Registers an upload with LinkedIn's Assets API, uploads the file's
        bytes to the URL it hands back, and returns the resulting asset URN
        for use as ShareMedia.media."""
        register_resp = httpx.post(
            f"{LINKEDIN_API}/assets?action=registerUpload",
            json={
                "registerUploadRequest": {
                    "recipes": [f"urn:li:digitalmediaRecipe:{recipe}"],
                    "owner": author,
                    "serviceRelationships": [
                        {"relationshipType": "OWNER", "identifier": "urn:li:userGeneratedContent"}
                    ],
                }
            },
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            timeout=30.0,
        )
        register_resp.raise_for_status()
        value = register_resp.json()["value"]
        upload_url = value["uploadMechanism"]["com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest"]["uploadUrl"]
        asset_urn = value["asset"]

        file_resp = httpx.get(asset_url, timeout=60.0)
        file_resp.raise_for_status()

        upload_resp = httpx.put(
            upload_url,
            content=file_resp.content,
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=60.0,
        )
        upload_resp.raise_for_status()

        return asset_urn

    def _post_ugc(
        self,
        *,
        access_token: str,
        external_account_id: str,
        text: str,
        media: list[dict] | None = None,
        media_category: str = "IMAGE",
    ) -> PublishResult:
        author = f"urn:li:person:{external_account_id}"
        share_content: dict = {
            "shareCommentary": {"text": text},
            "shareMediaCategory": media_category if media else "NONE",
        }
        if media:
            share_content["media"] = media

        payload = {
            "author": author,
            "lifecycleState": "PUBLISHED",
            "specificContent": {"com.linkedin.ugc.ShareContent": share_content},
            "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
        }
        resp = httpx.post(
            f"{LINKEDIN_API}/ugcPosts",
            json=payload,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json",
                "X-Restli-Protocol-Version": "2.0.0",
            },
            timeout=30.0,
        )
        if resp.status_code in (200, 201):
            return PublishResult(success=True, external_post_id=resp.headers.get("x-restli-id") or resp.json().get("id"))
        try:
            message = resp.json().get("message", resp.text)
        except Exception:
            message = resp.text
        return PublishResult(success=False, error_message=message)

    def publish_text(self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str]) -> PublishResult:
        text = f"{content}\n\n{' '.join(hashtags)}".strip()
        return self._post_ugc(access_token=access_token, external_account_id=external_account_id, text=text)

    def publish_image(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], image_urls: list[str]
    ) -> PublishResult:
        text = f"{content}\n\n{' '.join(hashtags)}".strip()
        author = f"urn:li:person:{external_account_id}"
        try:
            asset_urn = self._upload_asset(
                access_token=access_token, author=author, asset_url=image_urls[0], recipe="feedshare-image"
            )
        except httpx.HTTPStatusError as exc:
            return PublishResult(success=False, error_message=f"Image upload to LinkedIn failed: {exc.response.text}")
        return self._post_ugc(
            access_token=access_token,
            external_account_id=external_account_id,
            text=text,
            media=[{"status": "READY", "media": asset_urn}],
            media_category="IMAGE",
        )

    def publish_video(
        self, *, access_token: str, external_account_id: str, content: str, hashtags: list[str], video_url: str
    ) -> PublishResult:
        text = f"{content}\n\n{' '.join(hashtags)}".strip()
        author = f"urn:li:person:{external_account_id}"
        try:
            asset_urn = self._upload_asset(
                access_token=access_token, author=author, asset_url=video_url, recipe="feedshare-video"
            )
        except httpx.HTTPStatusError as exc:
            return PublishResult(success=False, error_message=f"Video upload to LinkedIn failed: {exc.response.text}")
        return self._post_ugc(
            access_token=access_token,
            external_account_id=external_account_id,
            text=text,
            media=[{"status": "READY", "media": asset_urn}],
            media_category="VIDEO",
        )

    def get_publishing_status(self, access_token: str, external_post_id: str) -> str:
        resp = httpx.get(
            f"{LINKEDIN_API}/ugcPosts/{external_post_id}",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=30.0,
        )
        return "PUBLISHED" if resp.status_code == 200 else "FAILED"
