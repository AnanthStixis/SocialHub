from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.media import MediaAssetOut


class PostPlatformOut(BaseModel):
    id: str
    platform: str
    content: str | None
    hashtags: list[str] | None
    status: str
    published_at: datetime | None
    external_post_id: str | None
    error_message: str | None
    social_account_id: str | None

    model_config = ConfigDict(from_attributes=True)


class PostOut(BaseModel):
    id: str
    idea: str
    status: str
    creation_mode: str
    target_audience: str | None
    objective: str | None
    brand_voice: str | None
    tone: str | None
    keywords: str | None
    language: str
    cta: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime
    platforms: list[PostPlatformOut]
    media: list[MediaAssetOut] = Field(default_factory=list, validation_alias="media_assets")
    scheduled_at: datetime | None = None
    scheduled_timezone: str | None = None

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PostCreate(BaseModel):
    idea: str = Field(default="New post")
    creation_mode: str = Field(default="MANUAL", pattern="^(MANUAL|AI)$")
    platforms: list[str] = Field(min_length=1)
    target_audience: str | None = None
    objective: str | None = None
    brand_voice: str | None = None
    tone: str | None = None
    keywords: str | None = None
    language: str = "English"
    cta: str | None = None
    # Manual mode: optional initial per-platform content
    manual_content: dict[str, str] | None = None


class PostUpdate(BaseModel):
    idea: str | None = None
    target_audience: str | None = None
    objective: str | None = None
    brand_voice: str | None = None
    tone: str | None = None
    keywords: str | None = None
    language: str | None = None
    cta: str | None = None


class PlatformContentUpdate(BaseModel):
    content: str
    hashtags: list[str] = []


class GenerateRequest(BaseModel):
    platforms: list[str] | None = None  # None = all platforms on the post
    topic: str | None = None  # if given, becomes the post's title and the generation topic


class RegenerateRequest(BaseModel):
    platform: str
    instruction: str | None = None


class PublishRequest(BaseModel):
    platforms: list[str] | None = None  # None = all platforms on the post


class ScheduleRequest(BaseModel):
    scheduled_at: datetime
    timezone: str = "UTC"
    platforms: list[str] | None = None  # None = all platforms on the post


class PlatformAccountsUpdate(BaseModel):
    # Explicit list of social_account ids to target, or None to mean "all
    # currently connected accounts for this platform".
    social_account_ids: list[str] | None = None
