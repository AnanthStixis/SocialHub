from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.post import Post
from app.models.enums import PostStatus
from app.schemas.calendar import CalendarEntry

router = APIRouter(prefix="/api/calendar", tags=["calendar"])


@router.get("", response_model=list[CalendarEntry])
def get_calendar(
    start: datetime = Query(...),
    end: datetime = Query(...),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    if end.tzinfo is None:
        end = end.replace(tzinfo=timezone.utc)

    posts = db.scalars(
        select(Post)
        .options(selectinload(Post.platforms), selectinload(Post.scheduled_posts))
        .where(
            Post.deleted_at.is_(None),
            Post.status.in_(
                [PostStatus.SCHEDULED, PostStatus.PUBLISHED, PostStatus.PARTIALLY_PUBLISHED, PostStatus.FAILED]
            ),
        )
    ).unique().all()

    entries: list[CalendarEntry] = []
    for post in posts:
        scheduled_at = post.scheduled_at
        published_dates = [p.published_at for p in post.platforms if p.published_at]
        published_at = min(published_dates) if published_dates else None

        relevant_date = scheduled_at or published_at
        if not relevant_date or not (start <= relevant_date <= end):
            continue

        entries.append(
            CalendarEntry(
                post_id=post.id,
                idea=post.idea,
                status=post.status.value,
                platforms=[p.platform.value for p in post.platforms],
                scheduled_at=scheduled_at,
                published_at=published_at,
            )
        )

    entries.sort(key=lambda e: e.scheduled_at or e.published_at or datetime.min.replace(tzinfo=timezone.utc))
    return entries
