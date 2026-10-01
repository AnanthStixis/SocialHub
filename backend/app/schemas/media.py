from datetime import datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, HttpUrl


class MediaUrlAttach(BaseModel):
    url: HttpUrl
    media_type: Literal["image", "video"]


class MediaAssetOut(BaseModel):
    id: str
    file_name: str
    file_url: str
    media_type: str
    mime_type: str | None
    order_index: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
