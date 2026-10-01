from pydantic import BaseModel, Field


class OpenAIStatusOut(BaseModel):
    configured: bool
    source: str  # "settings" | "env" | "none"
    model: str | None


class OpenAISaveRequest(BaseModel):
    api_key: str = Field(min_length=1)
    base_url: str | None = None
    model: str | None = None
