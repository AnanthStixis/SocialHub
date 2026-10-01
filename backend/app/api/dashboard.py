from collections import Counter
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.deps import get_current_user
from app.models.post import Post, PostPlatform
from app.models.social import SocialAccount
from app.models.workflow import ScheduledPost
from app.models.enums import PostStatus, PlatformContentStatus, SocialAccountStatus

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def get_dashboard(db: Session = Depends(get_db), _=Depends(get_current_user)):
    def count(status: PostStatus) -> int:
        return db.scalar(select(func.count()).select_from(Post).where(Post.status == status, Post.deleted_at.is_(None))) or 0

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    published_today = db.scalar(
        select(func.count())
        .select_from(PostPlatform)
        .where(PostPlatform.status == PlatformContentStatus.PUBLISHED, PostPlatform.published_at >= today_start)
    ) or 0
    failed_today = db.scalar(
        select(func.count())
        .select_from(PostPlatform)
        .where(PostPlatform.status == PlatformContentStatus.FAILED, PostPlatform.updated_at >= today_start)
    ) or 0
    connected_accounts = db.scalar(
        select(func.count()).select_from(SocialAccount).where(SocialAccount.status == SocialAccountStatus.CONNECTED, SocialAccount.deleted_at.is_(None))
    ) or 0

    trends, breakdown = _trends_and_breakdown(db, today_start)

    return {
        "trends": trends,
        "breakdown": breakdown,
        "total_posts": db.scalar(select(func.count()).select_from(Post).where(Post.deleted_at.is_(None))) or 0,
        "drafts": count(PostStatus.DRAFT),
        "scheduled": count(PostStatus.SCHEDULED),
        "published": count(PostStatus.PUBLISHED),
        "failed": count(PostStatus.FAILED),
        "published_today": published_today,
        "failed_today": failed_today,
        "connected_accounts": connected_accounts,
    }


TREND_DAYS = 14


def _series(days: list[str], dates) -> list[int]:
    counts = Counter(d.strftime("%Y-%m-%d") for d in dates if d)
    return [counts.get(day, 0) for day in days]


def _trends_and_breakdown(db: Session, today_start: datetime):
    """Daily counts for the last 14 days (oldest first) per KPI, plus a
    per-platform split of each KPI's current value for the hover popup."""
    since = today_start - timedelta(days=TREND_DAYS - 1)
    days = [(since + timedelta(days=i)).strftime("%Y-%m-%d") for i in range(TREND_DAYS)]

    scheduled_created = db.scalars(select(ScheduledPost.created_at).where(ScheduledPost.created_at >= since)).all()
    published_at = db.scalars(select(PostPlatform.published_at).where(PostPlatform.status == PlatformContentStatus.PUBLISHED, PostPlatform.published_at >= since)).all()
    failed_at = db.scalars(select(PostPlatform.updated_at).where(PostPlatform.status == PlatformContentStatus.FAILED, PostPlatform.updated_at >= since)).all()

    accounts = db.execute(
        select(SocialAccount.platform, SocialAccount.created_at).where(SocialAccount.status == SocialAccountStatus.CONNECTED, SocialAccount.deleted_at.is_(None))
    ).all()
    connected_daily = _series(days, [c for _, c in accounts])
    base = sum(1 for _, c in accounts if c < since)
    connected, running = [], base
    for n in connected_daily:  # cumulative: accounts connected up to each day
        running += n
        connected.append(running)

    def split(rows) -> dict[str, int]:
        return dict(Counter(p.value for p in rows))

    sched_platforms = db.scalars(
        select(PostPlatform.platform).join(Post, Post.id == PostPlatform.post_id).where(Post.status == PostStatus.SCHEDULED, Post.deleted_at.is_(None))
    ).all()
    pub_today = db.scalars(select(PostPlatform.platform).where(PostPlatform.status == PlatformContentStatus.PUBLISHED, PostPlatform.published_at >= today_start)).all()
    fail_today = db.scalars(select(PostPlatform.platform).where(PostPlatform.status == PlatformContentStatus.FAILED, PostPlatform.updated_at >= today_start)).all()

    return (
        {
            "days": days,
            "scheduled": _series(days, scheduled_created),
            "published": _series(days, published_at),
            "failed": _series(days, failed_at),
            "connected": connected,
        },
        {
            "scheduled": split(sched_platforms),
            "published": split(pub_today),
            "failed": split(fail_today),
            "connected": split(p for p, _ in accounts),
        },
    )
