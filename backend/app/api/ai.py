from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import require_roles, STAFF_ROLES
from app.models.enums import Platform, RoleName
from app.services.ai import assistant

router = APIRouter(
    prefix="/api/ai",
    tags=["ai"],
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)

TONES = "^(professional|casual|humorous|informative)$"


def _valid_platforms(platforms: list[str]) -> list[str]:
    valid = {p.value for p in Platform}
    if not platforms or any(p not in valid for p in platforms):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_PLATFORM", "message": "Select at least one valid platform"}},
        )
    return platforms


class ImproveRequest(BaseModel):
    content: str = Field(min_length=1, max_length=5000)
    platform: str
    tone: str = Field(default="professional", pattern=TONES)


class GenerateRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=500)
    platforms: list[str] = Field(min_length=1)
    count: int = Field(default=1, ge=1, le=5)


class UrlRequest(BaseModel):
    url: str = Field(min_length=1, max_length=2000)
    platforms: list[str] = Field(min_length=1)


@router.post("/improve")
def improve(payload: ImproveRequest, db: Session = Depends(get_db)):
    platform = _valid_platforms([payload.platform])[0]
    return assistant.improve_post(db, payload.content, platform, payload.tone)


@router.post("/generate")
def generate(payload: GenerateRequest, db: Session = Depends(get_db)):
    platforms = _valid_platforms(payload.platforms)
    return {"posts": assistant.generate_posts(db, payload.topic, platforms, payload.count)}


@router.post("/url-to-post")
def url_to_post(payload: UrlRequest, db: Session = Depends(get_db)):
    platforms = _valid_platforms(payload.platforms)
    return assistant.url_to_posts(db, payload.url, platforms)
