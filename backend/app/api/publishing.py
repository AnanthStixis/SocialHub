from datetime import datetime
from app.models.post import Post
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from app.db.session import get_db
from app.core.deps import get_current_user, require_roles, STAFF_ROLES
from app.models.workflow import PublishingJob
from app.models.enums import RoleName
from app.schemas.publishing import PublishingJobOut
from app.schemas.pagination import Page
from app.services.publishing import publish_post_platform
from app.models.post import PostPlatform

router = APIRouter(prefix="/api/publishing", tags=["publishing"])


def apply_job_filters(query, post_id=None, status_filter=None, platform=None, search=None, date_from=None, date_to=None):
    if post_id:
        query = query.where(PublishingJob.post_id == post_id)
    if status_filter:
        query = query.where(PublishingJob.status == status_filter)
    if platform:
        query = query.where(PublishingJob.platform == platform)
    if search and search.strip():
        term = f"%{search.strip().replace('%', '').replace('_', '')}%"
        query = query.where(PublishingJob.post_id.in_(select(Post.id).where(Post.idea.ilike(term))))
    if date_from:
        query = query.where(PublishingJob.updated_at >= date_from)
    if date_to:
        query = query.where(PublishingJob.updated_at < date_to)
    return query


@router.get("/jobs", response_model=Page[PublishingJobOut])
def list_publishing_jobs(
    post_id: str | None = None,
    status_filter: str | None = None,
    platform: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = apply_job_filters(select(PublishingJob), post_id, status_filter, platform, search, date_from, date_to)

    total = db.scalar(select(func.count()).select_from(query.subquery()))

    query = (
        query.options(
            selectinload(PublishingJob.attempts),
            selectinload(PublishingJob.post),
            selectinload(PublishingJob.post_platform).selectinload(PostPlatform.social_account),
        )
        .order_by(PublishingJob.updated_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = db.scalars(query).all()
    return Page(items=items, total=total or 0, page=page, page_size=page_size)


@router.post(
    "/jobs/{job_id}/retry",
    response_model=PublishingJobOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def retry_publishing_job(job_id: str, db: Session = Depends(get_db)):
    job = db.get(PublishingJob, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "JOB_NOT_FOUND", "message": "Publishing job not found"}},
        )
    post_platform = db.get(PostPlatform, job.post_platform_id)
    if not post_platform:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "PLATFORM_NOT_FOUND", "message": "Post platform not found"}},
        )
    publish_post_platform(db, post_platform)
    db.commit()
    db.refresh(job)
    return job
