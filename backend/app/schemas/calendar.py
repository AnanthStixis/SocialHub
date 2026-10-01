from datetime import datetime
from pydantic import BaseModel


class CalendarEntry(BaseModel):
    post_id: str
    idea: str
    status: str
    platforms: list[str]
    scheduled_at: datetime | None
    published_at: datetime | None
