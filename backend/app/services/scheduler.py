import asyncio
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.workflow import ScheduledPost
from app.models.enums import PostStatus
from app.services.publishing import publish_post

logger = logging.getLogger("scheduler")

POLL_INTERVAL_SECONDS = 30


def run_due_scheduled_posts() -> int:
    """Publish every post whose schedule is due and not cancelled. Returns
    the number of posts published. Safe to call repeatedly: publishing is
    idempotent per platform, so a post already fully published is a no-op."""
    db = SessionLocal()
    published_count = 0
    try:
        now = datetime.now(timezone.utc)
        due = db.scalars(
            select(ScheduledPost).where(ScheduledPost.cancelled.is_(False), ScheduledPost.scheduled_at <= now)
        ).all()
        for sp in due:
            post = sp.post
            if post.status != PostStatus.SCHEDULED:
                continue
            try:
                publish_post(db, post, platforms=None, user_id=sp.created_by)
                published_count += 1
            except Exception:
                logger.exception("Failed to publish scheduled post %s", post.id)
            sp.cancelled = True
            db.commit()
    finally:
        db.close()
    return published_count


async def scheduler_loop() -> None:
    while True:
        try:
            await asyncio.to_thread(run_due_scheduled_posts)
        except Exception:
            logger.exception("Scheduler tick failed")
        await asyncio.sleep(POLL_INTERVAL_SECONDS)
