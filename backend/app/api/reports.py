from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Literal
from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.api.posts import apply_post_filters
from app.api.publishing import apply_job_filters
from app.core.deps import STAFF_ROLES, require_roles
from app.db.session import get_db
from app.models.enums import PlatformContentStatus
from app.models.post import Post, PostPlatform
from app.models.workflow import PublishingJob
from app.services.exports import build_export
from app.services.publishing import _resolve_account_credentials
from app.services.social import get_social_provider

router = APIRouter(prefix="/api/reports", tags=["reports"], dependencies=[Depends(require_roles(*STAFF_ROLES))])

Format = Literal["csv", "xlsx", "pdf"]
MAX_ROWS = 10000


def _fmt(dt: datetime | None) -> str:
    return dt.astimezone().strftime("%Y-%m-%d %H:%M") if dt else ""


def _describe(date_from, date_to, **filters) -> str:
    parts = [f"{k}: {v}" for k, v in filters.items() if v]
    if date_from:
        parts.append(f"from {date_from:%Y-%m-%d}")
    if date_to:
        parts.append(f"to {(date_to - timedelta(days=1)):%Y-%m-%d}")
    return ", ".join(parts) or "All records"


@router.get("/posts")
def export_posts(
    format: Format = "csv",
    status_filter: str | None = Query(default=None, alias="status"),
    platform: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
):
    query = apply_post_filters(select(Post), status_filter, None, platform, search, date_from, date_to)
    posts = db.scalars(query.options(selectinload(Post.platforms)).order_by(Post.created_at.desc()).limit(MAX_ROWS)).unique().all()
    columns = ["Post", "Status", "Platforms", "Scheduled for", "Created", "Failed platforms"]
    rows = [
        [
            p.idea,
            p.status.value.replace("_", " ").title(),
            ", ".join(sorted({pp.platform.value.title() for pp in p.platforms})),
            _fmt(getattr(p, "scheduled_at", None)),
            _fmt(p.created_at),
            ", ".join(sorted({pp.platform.value.title() for pp in p.platforms if pp.status.value == "FAILED"})),
        ]
        for p in posts
    ]
    content, media, name = build_export(format, "Posts report", columns, rows, _describe(date_from, date_to, status=status_filter, platform=platform, search=search))
    return Response(content, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/publishing")
def export_publishing(
    format: Format = "csv",
    status_filter: str | None = None,
    platform: str | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: Session = Depends(get_db),
):
    query = apply_job_filters(select(PublishingJob), None, status_filter, platform, search, date_from, date_to)
    jobs = db.scalars(
        query.options(selectinload(PublishingJob.attempts), selectinload(PublishingJob.post), selectinload(PublishingJob.post_platform).selectinload(PostPlatform.social_account))
        .order_by(PublishingJob.updated_at.desc())
        .limit(MAX_ROWS)
    ).all()
    columns = ["Post", "Platform", "Page / account", "Status", "Attempts", "Last result", "Updated"]
    rows = []
    for j in jobs:
        last = j.attempts[-1] if j.attempts else None
        result = "" if not last else (f"Published ({last.external_post_id})" if last.success else (last.error_message or "Failed"))
        rows.append([j.post_idea or j.post_id, j.platform.value.title(), j.page_name or "", j.status.value.title(), f"{j.attempt_count}/{j.max_attempts}", result, _fmt(j.updated_at)])
    content, media, name = build_export(format, "Publishing report", columns, rows, _describe(date_from, date_to, status=status_filter, platform=platform, search=search))
    return Response(content, media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"'})


@router.get("/summary")
def summary(date_from: datetime | None = None, date_to: datetime | None = None, db: Session = Depends(get_db)):
    """Aggregates for the Analytics page over the chosen created-at range."""
    posts = db.scalars(apply_post_filters(select(Post), None, None, None, None, date_from, date_to).options(selectinload(Post.platforms))).unique().all()
    jobs = db.scalars(apply_job_filters(select(PublishingJob), None, None, None, None, date_from, date_to)).all()

    by_status = Counter(p.status.value for p in posts)
    by_platform = Counter(pp.platform.value for p in posts for pp in p.platforms if pp.status.value == "PUBLISHED")
    job_status = Counter(j.status.value for j in jobs)
    daily = Counter(p.created_at.astimezone().strftime("%Y-%m-%d") for p in posts)
    finished = job_status["SUCCESS"] + job_status["FAILED"]

    # Daily series for the KPI sparklines: the chosen range, capped to its last 30 days (14 when open-ended).
    end_day = (date_to - timedelta(days=1)) if date_to else datetime.now(timezone.utc)
    n_days = 14
    if date_from:
        n_days = max(2, min(30, (end_day.date() - date_from.astimezone(timezone.utc).date()).days + 1))
    days = [(end_day - timedelta(days=n_days - 1 - i)).strftime("%Y-%m-%d") for i in range(n_days)]

    def per_day(dates) -> list[int]:
        c = Counter(d.strftime("%Y-%m-%d") for d in dates if d)
        return [c.get(day, 0) for day in days]

    ok_days = per_day([j.updated_at for j in jobs if j.status.value == "SUCCESS"])
    bad_days = per_day([j.updated_at for j in jobs if j.status.value == "FAILED"])
    trends = {
        "days": days,
        "total": per_day([p.created_at for p in posts]),
        "published": per_day([pp.published_at for p in posts for pp in p.platforms if pp.status.value == "PUBLISHED"]),
        "failed": per_day([p.created_at for p in posts if p.status.value == "FAILED"]),
        "success_rate": [round(100 * o / (o + b)) if o + b else 0 for o, b in zip(ok_days, bad_days)],
    }
    job_by_platform = {}
    for j in jobs:
        s_ = job_by_platform.setdefault(j.platform.value, {"SUCCESS": 0, "FAILED": 0})
        if j.status.value in s_:
            s_[j.status.value] += 1
    breakdown = {
        "total": dict(Counter(pp.platform.value for p in posts for pp in p.platforms)),
        "published": dict(by_platform),
        "failed": dict(Counter(pp.platform.value for p in posts for pp in p.platforms if pp.status.value == "FAILED")),
        "success_rate": {k: round(100 * v["SUCCESS"] / (v["SUCCESS"] + v["FAILED"])) for k, v in job_by_platform.items() if v["SUCCESS"] + v["FAILED"]},
    }
    return {
        "trends": trends,
        "breakdown": breakdown,
        "total_posts": len(posts),
        "published_deliveries": sum(by_platform.values()),
        "by_status": dict(by_status),
        "published_by_platform": dict(by_platform),
        "jobs": dict(job_status),
        "success_rate": round(100 * job_status["SUCCESS"] / finished, 1) if finished else None,
        "daily_posts": [{"date": d, "count": c} for d, c in sorted(daily.items())],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/engagement/sync")
def sync_engagement(date_from: datetime | None = None, date_to: datetime | None = None, db: Session = Depends(get_db)):
    """Pulls current like/comment counts from each platform for published posts in the range."""
    posts = db.scalars(apply_post_filters(select(Post), None, None, None, None, date_from, date_to).options(selectinload(Post.platforms))).unique().all()
    synced = failed = 0
    for pp in (pp for p in posts for pp in p.platforms):
        if pp.status != PlatformContentStatus.PUBLISHED or not pp.external_post_id:
            continue
        try:
            creds = _resolve_account_credentials(db, pp)
            if not creds:
                raise RuntimeError("no account")
            eng = get_social_provider(pp.platform.value, db).get_engagement(creds[1], pp.external_post_id)
            pp.likes_count, pp.comments_count = eng.likes, eng.comments
            pp.engagement_synced_at = datetime.now(timezone.utc)
            synced += 1
        except Exception:  # noqa: BLE001 - one bad platform must not stop the rest
            failed += 1
    db.commit()
    return {"synced": synced, "failed": failed}


@router.get("/engagement")
def engagement(date_from: datetime | None = None, date_to: datetime | None = None, db: Session = Depends(get_db)):
    """Posts / likes / comments: consolidated totals (overall and per platform) plus one row per post."""
    posts = db.scalars(
        apply_post_filters(select(Post), None, None, None, None, date_from, date_to)
        .options(selectinload(Post.platforms))
        .order_by(Post.created_at.desc())
    ).unique().all()
    totals = {"posts": 0, "likes": 0, "comments": 0}
    by_platform: dict[str, dict[str, int]] = {}
    rows = []
    items = []
    for p in posts:
        published = [pp for pp in p.platforms if pp.status == PlatformContentStatus.PUBLISHED]
        if not published:
            continue
        likes = sum(pp.likes_count for pp in published)
        comments = sum(pp.comments_count for pp in published)
        totals["posts"] += 1
        totals["likes"] += likes
        totals["comments"] += comments
        for pp in published:
            b = by_platform.setdefault(pp.platform.value, {"posts": 0, "likes": 0, "comments": 0})
            b["posts"] += 1
            b["likes"] += pp.likes_count
            b["comments"] += pp.comments_count
        for pp in published:
            items.append({
                "post_id": p.id,
                "idea": p.idea,
                "platform": pp.platform.value,
                "published_at": pp.published_at,
                "likes": pp.likes_count,
                "comments": pp.comments_count,
            })
        rows.append({
            "post_id": p.id,
            "idea": p.idea,
            "published_at": max((pp.published_at for pp in published if pp.published_at), default=None),
            "likes": likes,
            "comments": comments,
            "platforms": [{"platform": pp.platform.value, "likes": pp.likes_count, "comments": pp.comments_count} for pp in published],
        })
    return {"totals": totals, "by_platform": by_platform, "posts": rows, "items": items, "last_synced": max((pp.engagement_synced_at for p in posts for pp in p.platforms if pp.engagement_synced_at), default=None)}
