from datetime import datetime
from pydantic import BaseModel, ConfigDict


class PublishingAttemptOut(BaseModel):
    id: str
    attempt_number: int
    success: bool
    external_post_id: str | None
    error_message: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PublishingJobOut(BaseModel):
    id: str
    post_id: str
    post_platform_id: str
    platform: str
    status: str
    attempt_count: int
    max_attempts: int
    created_at: datetime
    updated_at: datetime
    attempts: list[PublishingAttemptOut]
    post_idea: str | None = None
    page_name: str | None = None

    model_config = ConfigDict(from_attributes=True)
