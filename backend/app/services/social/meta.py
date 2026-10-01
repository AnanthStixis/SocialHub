import httpx
from urllib.parse import urlencode
from app.services.social.base import ConnectResult

GRAPH_API_VERSION = "v19.0"
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"

# Only the permissions this app actually uses: reading the user's identity,
# listing and posting to their Pages, and publishing to a Page's linked
# Instagram Business account. Meta review would (rightly) flag requesting
# ads/insights scopes an app never calls, so those are deliberately excluded.
META_SCOPES = [
    "email",
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
]


def meta_authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "state": state,
        "scope": ",".join(META_SCOPES),
        "response_type": "code",
    }
    return f"https://www.facebook.com/{GRAPH_API_VERSION}/dialog/oauth?{urlencode(params)}"


def meta_connect(client_id: str, client_secret: str, auth_code: str, redirect_uri: str) -> dict[str, list[ConnectResult]]:
    """One OAuth round trip that sets up Facebook Page publishing for every
    Page the user manages, plus (for any Page that has one linked) Instagram
    Business account publishing — avoiding a second, redundant Facebook
    consent screen for Instagram."""
    token_resp = httpx.get(
        f"{GRAPH_BASE}/oauth/access_token",
        params={
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "code": auth_code,
        },
        timeout=30.0,
    )
    token_resp.raise_for_status()
    user_token = token_resp.json()["access_token"]

    long_lived_resp = httpx.get(
        f"{GRAPH_BASE}/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": client_id,
            "client_secret": client_secret,
            "fb_exchange_token": user_token,
        },
        timeout=30.0,
    )
    long_lived_resp.raise_for_status()
    long_lived_token = long_lived_resp.json()["access_token"]

    pages_resp = httpx.get(
        f"{GRAPH_BASE}/me/accounts",
        params={"fields": "id,name,access_token,instagram_business_account", "access_token": long_lived_token},
        timeout=30.0,
    )
    pages_resp.raise_for_status()
    pages = pages_resp.json().get("data", [])
    if not pages:
        raise ValueError("No Facebook Pages available for this account")

    facebook_results: list[ConnectResult] = []
    instagram_results: list[ConnectResult] = []

    for page in pages:
        facebook_results.append(
            ConnectResult(
                external_account_id=page["id"],
                account_name=page["name"],
                access_token=page["access_token"],
                refresh_token=None,
                expires_at=None,
            )
        )

        ig_account = page.get("instagram_business_account")
        if ig_account:
            ig_id = ig_account["id"]
            ig_resp = httpx.get(
                f"{GRAPH_BASE}/{ig_id}", params={"fields": "username", "access_token": page["access_token"]}, timeout=30.0
            )
            ig_resp.raise_for_status()
            username = ig_resp.json().get("username", ig_id)
            instagram_results.append(
                ConnectResult(
                    external_account_id=ig_id,
                    account_name=f"@{username}",
                    access_token=page["access_token"],
                    refresh_token=None,
                    expires_at=None,
                )
            )

    return {"FACEBOOK": facebook_results, "INSTAGRAM": instagram_results}
