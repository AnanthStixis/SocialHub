# Social Media Content & Publishing Hub

A production-grade replacement for the Google Sheets + Make.com content pipeline: manual/AI content creation, platform-specific generation, and scheduling/publishing to Facebook, Instagram, and LinkedIn — architected so new platforms (X/Twitter, YouTube, Threads, TikTok, Pinterest) can be added without a data-model redesign.

**Single-admin, no-approval-gate model:** this app is designed for one admin user running the whole pipeline — there is no reviewer/approver role or approval queue. A post goes `DRAFT → SCHEDULED → PUBLISHED` (or straight to `PUBLISHED` via Publish Now); the only backend-enforced gate before publishing is that every targeted platform actually has content.

## Status

- [x] **Phase 1** — Architecture, PostgreSQL schema, JWT auth + refresh tokens, single-admin RBAC, basic dashboard UI (end-to-end verified: migrations applied to a real local Postgres 18 instance, seed data loaded, login → dashboard flow tested in-browser against the running backend)
- [x] **Phase 2** — Post creation (manual + AI), `AIProvider` abstraction (demo + OpenAI-compatible), platform-specific generation/regeneration, content editor with live preview, version history (end-to-end verified in-browser: create → generate all platforms → edit → regenerate one platform with an instruction → preview updates live)
- [x] **Phase 3** — Publish Now and Schedule-for-later, `SocialMediaProvider` abstraction (demo provider, real per-platform integrations plug in later), independent per-platform publishing jobs with idempotency, in-process scheduler for local dev (end-to-end verified: published a post immediately, confirmed a second publish call is rejected as already-published, scheduled a post 20s out and confirmed the background scheduler auto-published it without any manual trigger)
- [x] **Phase 4** — Social account connect/reconnect/disconnect/test, real `FacebookProvider`/`InstagramProvider`/`LinkedInProvider` implementations of `SocialMediaProvider` (Graph API / LinkedIn UGC Posts API), OAuth authorize-URL + callback flow, encrypted token storage, publishing now resolves the actually-connected account instead of a hardcoded placeholder. Platform app credentials (Client ID/Secret) are managed from Settings → Platform Apps in the UI, encrypted in the database — `.env` is never required for this (end-to-end verified in demo mode: connected all three platforms, confirmed tokens are Fernet-encrypted at rest in Postgres — not plaintext, published a post that resolved real per-platform credentials, disconnected Facebook and confirmed it drops out of the account list, saved/removed Facebook app credentials through the live UI and confirmed the resulting authorize-URL is a correct, real Facebook OAuth link. The real Graph/LinkedIn API calls are implemented per the official docs but unverified against live endpoints — no Meta/LinkedIn developer app credentials are available in this environment)
- [ ] Phase 5 — Redis/Celery worker + beat for production-grade scheduling, retry/backoff on publish failure
- [x] **Phase 6** — Calendar view, notifications center, publishing history/log UI (end-to-end verified: generating/scheduling/publishing a post now fires real notifications with an unread-count badge in the header, mark-read/mark-all-read work live; the month calendar correctly places scheduled and published posts on their real dates; the Publishing page lists every job across every post tested so far with per-attempt detail and a working Retry action)
- [ ] Phase 7 — Full test suite, Docker hardening, deployment docs

## Architecture

```
Browser
  │
  ▼
Nginx (reverse proxy)
  │           │
  ▼           ▼
Frontend    Backend (FastAPI)
(React/Vite)    │
                ▼
          PostgreSQL ── Redis ── Celery workers/scheduler
                                     │
                                     ▼
                         SocialMediaProvider abstraction
                         (Facebook / Instagram / LinkedIn ...)
```

**Backend:** FastAPI + SQLAlchemy 2.0 + Alembic + Pydantic v2, JWT access/refresh tokens, single `ADMIN` role via `roles` / `user_roles` (kept as a table, not a hardcoded check, so more roles can be reintroduced later without a rewrite).

**Data model:** Platform-specific content lives in `post_platforms` (one row per post per platform), never as flat `facebook_content` / `instagram_content` columns — so adding a platform is a data row, not a schema migration. See [`backend/app/models`](backend/app/models) for the full normalized schema (users, roles, social accounts + encrypted tokens, posts, post_platforms, post_versions, media_assets, hashtags, scheduled_posts, publishing_jobs/attempts, notifications, audit_logs, ai_generations/versions, prompt_templates, system/brand settings). There is no campaign concept — this app manages individual posts only.

**Social connections:** Facebook and Instagram are one Meta login (Instagram publishing goes through a Facebook Page's linked Instagram Business account), so Settings → Social Accounts presents them as a single "Meta connection" with one Connect button, matching how a real Meta app actually works — not two separate, redundant consent screens. LinkedIn is a separate connection with its own developer app.

**Frontend:** React + TypeScript + Vite + Tailwind, Zustand for auth session state, TanStack Query for server state, Axios with bearer-token interceptor.

## Team, roles and invitations

- **Team & Roles** (Admin only) lists members and invites new ones (first name, last name, email, role). Two roles exist: **Admin** (everything, including Settings, Team & Roles and Email Template) and **Publisher** (dashboard, compose, all posts, calendar, publishing, analytics; no settings or team management). Roles are enforced in the API (`STAFF_ROLES` / `require_roles`) as well as hidden in the UI.
- An invite creates the account immediately with the default password (`DEFAULT_USER_PASSWORD`, `Stixis@123`) and emails a link. Opening the link (or signing in) marks it accepted; the first sign-in forces a password change.
- The invitation email (logo, wording, colours) is edited under **Email Template**; SMTP is configured with the `SMTP_*` / `EMAIL_*` variables in `.env`.
- **Analytics**, **All Posts** and **Publishing** can download reports as PDF, Excel or CSV. Run `pip install -r requirements.txt` and `alembic upgrade head` after pulling this change.

## Local development (no Docker)

Docker is used only for deployment (see below) — local development runs directly against natively installed PostgreSQL/Redis and the Python/Node toolchains.

### Prerequisites

- Python 3.12+
- Node.js 20+ (developed/tested against Node 22)
- PostgreSQL 16+ running locally
- Redis 7 running locally (needed from Phase 5 onward, not required yet)

### Environment variables

The backend loads `backend/.env` (via `pydantic-settings`, relative to the process's working directory, which is `backend/` when you run `uvicorn` from there). Copy the example and fill in your local Postgres credentials:

```bash
cd backend
cp ../.env.example .env
```

Edit `backend/.env` and set `DATABASE_URL` to your local Postgres, e.g.:

```
DATABASE_URL=postgresql+psycopg2://postgres:<your-password>@localhost:5432/smhub
```

Generate a token-encryption key (used to encrypt social OAuth tokens at rest) and paste it into `TOKEN_ENCRYPTION_KEY`:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt

# Create the database once:
psql -U postgres -c "CREATE DATABASE smhub;"

alembic upgrade head
python -m app.db.seed

uvicorn app.main:app --reload --port 8000
```

The API is now at `http://localhost:8000`, docs at `http://localhost:8000/docs`.

Seeded admin user (password shown is the seeded password):

| Email | Password | Role |
|---|---|---|
| admin@example.com | Admin@12345 | ADMIN |

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and log in with the admin credentials above. The Vite dev server proxies `/api` to `http://localhost:8000`.

## Deployment (Docker)

Docker Compose is the deployment path only — it builds production images for the backend and frontend and wires them together with Postgres, Redis, Celery worker/scheduler, and an Nginx reverse proxy.

```bash
cp .env.qa.example .env   # QA server: fill in DATABASE_URL (Postgres on 10.0.0.15) and the secrets
docker compose --env-file .env -f docker/docker-compose.yml up --build -d
```

Only Nginx is published to the host, so a single port needs to be free on the server:

- App via Nginx: `http://10.0.0.16:8014` (change the `8014:80` mapping in `docker/docker-compose.yml` and the three URLs in `.env` together if you need another port)
- Postgres is external (10.0.0.15), so it is not part of the compose file. Redis, the backend and the frontend stay inside the Docker network and are not reachable from outside.
- Uploaded media and email logos live in the `uploads_data` volume; the database is on the external Postgres server.
- The first start seeds `admin@example.com` / `Admin@12345`. Sign in and change that password straight away (avatar menu → Edit profile).

## Database migrations

Alembic is configured in `backend/alembic`. The initial migration (`0001_initial_schema`) creates the full schema from the SQLAlchemy models in one pass; later phases add incremental migrations as new tables/columns are introduced.

```bash
cd backend
alembic revision -m "add something"   # create a new migration
alembic upgrade head                  # apply migrations
alembic downgrade -1                  # roll back one migration
```

## Seed data

```bash
python -m app.db.seed
```

Creates the `ADMIN` role, one admin user, default brand settings, and default AI prompt templates for Facebook/Instagram/LinkedIn.

## Demo mode

`DEMO_MODE=true` (default) makes `get_social_provider()` return `DemoSocialProvider`, which simulates connecting, publishing, and disconnecting, generating a fake external account/post ID per platform — so the whole loop (Settings → connect → create a post → publish) works end-to-end with zero real Facebook/Instagram/LinkedIn credentials.

## Social account connections

Settings → Social Accounts ([frontend/src/pages/SettingsSocialAccountsPage.tsx](frontend/src/pages/SettingsSocialAccountsPage.tsx)) lists Facebook/Instagram/LinkedIn with their connection status, account name/ID, and Connect / Reconnect / Disconnect / Test Connection actions, per the spec.

`SocialMediaProvider` ([backend/app/services/social](backend/app/services/social)) is the abstraction every platform integration implements — `connect`, `disconnect`, `validate_connection`, `get_account`, `publish_text/image/video`, `get_publishing_status` — so a future platform (X/Twitter, YouTube, Threads, TikTok, Pinterest) is a new class, not a rewrite of the OAuth flow or publishing engine:

- **`DemoSocialProvider`** — used whenever `DEMO_MODE=true`. "Connect" is instant (`POST /api/social-accounts/{platform}/connect`, no real OAuth round trip).
- **`FacebookProvider`** / **`InstagramProvider`** / **`LinkedInProvider`** — real Graph API / LinkedIn UGC Posts API implementations, used automatically once `DEMO_MODE=false` and that platform's `*_CLIENT_ID` / `*_CLIENT_SECRET` are set. Connecting goes through the real OAuth flow: `GET /api/social-accounts/{platform}/authorize-url` returns the consent URL, the browser is sent there, the platform redirects back to `GET /api/social-accounts/{platform}/callback`, which exchanges the code for a token and redirects to the Settings page. Instagram publishing goes through its linked Facebook Page, matching how Meta's Instagram Graph API actually works, and correctly rejects text-only posts (Instagram requires an image or video). **These real providers are implemented against the official API docs but have not been exercised against live endpoints** — there are no Meta/LinkedIn developer app credentials available in this environment. `DemoSocialProvider` is what's actually been verified end-to-end.

Access/refresh tokens are Fernet-encrypted (`TOKEN_ENCRYPTION_KEY`) before being written to `social_account_tokens` — confirmed by inspecting the table directly (see Security notes below) — and are never sent to the frontend.

Publishing resolves the real connected account for each platform at publish time (`_resolve_account_credentials` in [backend/app/services/publishing.py](backend/app/services/publishing.py)); if no account is connected for a targeted platform (and not in demo mode), that platform's job fails with a clear message rather than silently using a placeholder.

## Scheduling

Scheduling a post creates a `ScheduledPost` row and sets the post to `SCHEDULED`. Locally, a lightweight in-process asyncio loop (started in `app/main.py`'s lifespan, polling every 30s — see [backend/app/services/scheduler.py](backend/app/services/scheduler.py)) checks for due schedules and publishes them automatically, so "schedule for later" actually works without Docker, Redis, or Celery running. In deployment, Celery beat (already wired in `docker/docker-compose.yml`) takes over the same job for reliability across multiple workers/restarts.

Publishing is per-platform and idempotent: each platform is published independently via its own `PublishingJob` keyed by an idempotency key, so one platform failing never blocks the others, and retrying/re-triggering a publish never double-posts a platform that already succeeded — the post's overall status becomes `PUBLISHED`, `PARTIALLY_PUBLISHED`, or `FAILED` based on the aggregate outcome.

## AI configuration

`AIProvider` ([backend/app/services/ai](backend/app/services/ai)) is the abstraction every content-generation call goes through:

- `DemoAIProvider` — deterministic, offline, platform-differentiated content generator. Used automatically whenever `DEMO_MODE=true` or `OPENAI_API_KEY` is unset, so the full create → generate → regenerate → preview workflow is testable with zero external dependencies.
- `OpenAIProvider` — calls any OpenAI-compatible `/chat/completions` endpoint (`OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`) with a forced JSON response shape, one object keyed by platform.

Adding Claude/Gemini/a local LLM later means implementing `AIProvider.generate_platform_content` and switching `get_ai_provider()` — nothing in the API layer or frontend changes.

Per-platform system prompts/instructions are stored in the `prompt_templates` table (seeded with Facebook/Instagram/LinkedIn defaults) and are meant to be admin-editable later; `get_platform_instructions()` falls back to hardcoded defaults if a template is missing.

## Testing

```bash
cd backend
pytest
```

Playwright E2E tests and frontend unit tests land in Phase 7.

## Security notes already in place

- Passwords hashed with bcrypt (direct `bcrypt` library, not the unmaintained `passlib`)
- JWT access tokens (short-lived) + hashed, revocable refresh tokens
- RBAC enforced server-side via `require_roles` dependency, not just in the UI
- Standardized error envelope: `{"success": false, "error": {"code": ..., "message": ...}}`
- Social OAuth tokens are encrypted at rest (Fernet) and decrypted only server-side when a provider call needs them — confirmed never plaintext in Postgres, never returned by any API response
- Secrets are never committed; `.env.example` only contains placeholders

## Connecting real Facebook/Instagram/LinkedIn accounts

OAuth fundamentally requires a Client ID/Secret — that's how Facebook/LinkedIn know which app is asking for access before they show the user a login/consent screen. There's no way around registering an app with each platform, but you never have to edit `.env` for it:

1. Register an app once at [Meta for Developers](https://developers.facebook.com/apps) (covers both Facebook and Instagram — they're one login) and the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps).
2. Register this OAuth redirect URI on the Meta app: `{APP_URL}/api/social-accounts/meta/callback`, and this one on the LinkedIn app: `{APP_URL}/api/social-accounts/linkedin/callback`.
3. In the app itself, go to **Settings → Platform Apps** and paste the Meta app's and LinkedIn app's Client ID/Secret into the form there. They're encrypted (Fernet) and stored in the database — `.env` is never touched.
4. Set `DEMO_MODE=false` in `.env` (this one flag still lives in `.env` since it's a deployment-wide switch, not a per-platform credential).

From then on, clicking **Connect Facebook account** under "Meta connection" does one full browser redirect to Facebook's real login screen requesting exactly the permissions this app uses (`email`, `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`, `business_management` — deliberately no ads/insights scopes, since this app doesn't call those APIs and Meta review would flag requesting permissions you never use). The callback ([backend/app/services/social/meta.py](backend/app/services/social/meta.py)) fetches the user's Facebook Pages and, from the same token, the Page's linked Instagram Business account — connecting both from that one consent screen instead of asking for Facebook approval twice. LinkedIn connects the same way through its own separate button. If a platform's app credentials aren't set yet, the UI shows an inline prompt linking straight to Platform Apps instead of failing silently.

`GET /api/settings/platform-apps` / `PUT .../{platform}` / `DELETE .../{platform}` back the credential storage (see [backend/app/services/platform_credentials.py](backend/app/services/platform_credentials.py) and [backend/app/api/platform_apps.py](backend/app/api/platform_apps.py)); `.env` values still work as a fallback if nothing is saved in Settings, so existing deployments aren't broken. Instagram publishing goes through its linked Facebook Page, so that Page needs a linked Instagram **Business** account.
