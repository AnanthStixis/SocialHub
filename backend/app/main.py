import asyncio
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.exceptions import HTTPException as StarletteHTTPException
from app.core.config import get_settings
from app.core.security import EncryptionKeyError
from app.api import auth, dashboard, posts, social_accounts, platform_apps, calendar, notifications, publishing, media, ai_settings, ai, team, email_template, reports, organization
from app.services.scheduler import scheduler_loop

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Lightweight in-process scheduler: polls for due scheduled posts and
    # publishes them. Sufficient for local/single-admin use; Celery beat
    # (see docker/docker-compose.yml) takes over this role in deployment.
    task = asyncio.create_task(scheduler_loop())
    yield
    task.cancel()


app = FastAPI(title=settings.APP_NAME, version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if isinstance(exc.detail, dict) and "success" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": "HTTP_ERROR", "message": str(exc.detail)}},
    )


@app.exception_handler(EncryptionKeyError)
async def encryption_key_handler(request: Request, exc: EncryptionKeyError):
    return JSONResponse(status_code=500, content={"success": False, "error": {"code": "ENCRYPTION_KEY", "message": str(exc)}})


app.include_router(auth.router)
app.include_router(dashboard.router)
app.include_router(posts.router)
app.include_router(social_accounts.router)
app.include_router(platform_apps.router)
app.include_router(calendar.router)
app.include_router(notifications.router)
app.include_router(publishing.router)
app.include_router(media.router)
app.include_router(ai_settings.router)
app.include_router(ai.router)
app.include_router(team.router)
app.include_router(organization.router)
app.include_router(email_template.router)
app.include_router(reports.router)

_uploads_dir = Path(__file__).resolve().parent.parent / "uploads"
_uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(_uploads_dir)), name="uploads")


@app.get("/api/health")
def health():
    return {"status": "ok", "demo_mode": settings.DEMO_MODE}
