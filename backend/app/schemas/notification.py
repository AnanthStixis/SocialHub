from datetime import datetime
from pydantic import BaseModel, ConfigDict


class NotificationOut(BaseModel):
    id: str
    type: str
    title: str
    body: str | None
    entity_type: str | None
    entity_id: str | None
    is_read: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UnreadCountOut(BaseModel):
    unread: int
