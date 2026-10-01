from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload
from app.core.config import get_settings
from app.core.security import decrypt_secret
from app.models.post import Post, PostPlatform
from app.models.social import SocialAccount
from app.models.workflow import PublishingJob, PublishingAttempt
from app.models.enums import PostStatus, PlatformContentStatus, PublishingJobStatus, SocialAccountStatus, AuditAction
from app.services.social import get_social_provider
from app.services.audit import record_audit
from app.services.notifications import notify
from app.services.rich_text import to_plain_text
from app.models.enums import NotificationType

settings = get_settings()


def _resolve_account_credentials(db: Session, post_platform: PostPlatform) -> tuple[str, str] | None:
    """Returns (external_account_id, access_token) for the account this row
    targets, or None if it can't be resolved. In DEMO_MODE a placeholder is
    used since DemoSocialProvider ignores both values.

    Uses post_platform.social_account_id when set (the specific Page/account
    chosen for this row via the "select a Page" UI). Falls back to the
    earliest-connected account for the platform for older rows that predate
    that selection."""
    if settings.DEMO_MODE:
        return "demo-account", "demo-token"

    query = select(SocialAccount).options(selectinload(SocialAccount.token)).where(SocialAccount.deleted_at.is_(None))
    if post_platform.social_account_id:
        query = query.where(SocialAccount.id == post_platform.social_account_id)
    else:
        query = query.where(
            SocialAccount.platform == post_platform.platform,
            SocialAccount.status == SocialAccountStatus.CONNECTED,
        ).order_by(SocialAccount.created_at.asc())

    account = db.scalar(query)
    if not account or not account.token:
        return None
    return account.external_account_id, decrypt_secret(account.token.encrypted_access_token)


def _idempotency_key(post_platform_id: str) -> str:
    return f"post_platform:{post_platform_id}"


def publish_post_platform(db: Session, post_platform: PostPlatform) -> PublishingJob:
    """Publish a single platform's content. Idempotent: if a job already
    succeeded for this post_platform, it is returned unchanged rather than
    publishing again."""
    key = _idempotency_key(post_platform.id)
    job = db.scalar(select(PublishingJob).where(PublishingJob.idempotency_key == key))

    if job and job.status == PublishingJobStatus.SUCCESS:
        return job

    if not job:
        job = PublishingJob(
            post_id=post_platform.post_id,
            post_platform_id=post_platform.id,
            platform=post_platform.platform,
            idempotency_key=key,
            status=PublishingJobStatus.PENDING,
        )
        db.add(job)
        db.flush()

    job.status = PublishingJobStatus.IN_PROGRESS
    job.attempt_count += 1

    credentials = _resolve_account_credentials(db, post_platform)
    if not credentials:
        result = None
        error_message = (
            f"No connected {post_platform.platform.value.title()} account. "
            "Connect one in Settings → Social Accounts before publishing."
        )
    else:
        external_account_id, access_token = credentials
        try:
            provider = get_social_provider(post_platform.platform.value, db)
            media = sorted(post_platform.post.media_assets, key=lambda m: m.order_index)
            content = to_plain_text(post_platform.content)
            hashtags = post_platform.hashtags or []
            videos = [m for m in media if m.media_type == "video"]
            images = [m for m in media if m.media_type == "image"]
            if videos:
                result = provider.publish_video(
                    access_token=access_token,
                    external_account_id=external_account_id,
                    content=content,
                    hashtags=hashtags,
                    video_url=videos[0].file_url,
                )
            elif images:
                result = provider.publish_image(
                    access_token=access_token,
                    external_account_id=external_account_id,
                    content=content,
                    hashtags=hashtags,
                    image_urls=[m.file_url for m in images],
                )
            else:
                result = provider.publish_text(
                    access_token=access_token,
                    external_account_id=external_account_id,
                    content=content,
                    hashtags=hashtags,
                )
        except Exception as exc:  # noqa: BLE001 - surface any provider failure as a failed attempt
            result = None
            error_message = str(exc)
        else:
            error_message = result.error_message if not result.success else None

    success = bool(result and result.success)

    db.add(
        PublishingAttempt(
            job_id=job.id,
            attempt_number=job.attempt_count,
            success=success,
            external_post_id=result.external_post_id if result else None,
            error_message=error_message,
        )
    )

    if success:
        job.status = PublishingJobStatus.SUCCESS
        post_platform.status = PlatformContentStatus.PUBLISHED
        post_platform.published_at = datetime.now(timezone.utc)
        post_platform.external_post_id = result.external_post_id
        post_platform.error_message = None
    else:
        job.status = (
            PublishingJobStatus.FAILED if job.attempt_count >= job.max_attempts else PublishingJobStatus.RETRYING
        )
        post_platform.status = PlatformContentStatus.FAILED
        post_platform.error_message = error_message or "Publishing failed"

    return job


def publish_post(db: Session, post: Post, platforms: list[str] | None, user_id: str | None) -> Post:
    """Publish a post to some or all of its platforms independently. One
    platform failing never blocks the others; overall post status reflects
    the aggregate outcome."""
    targets = [pp for pp in post.platforms if platforms is None or pp.platform.value in platforms]

    post.status = PostStatus.PUBLISHING
    db.flush()
    record_audit(db, user_id, AuditAction.PUBLISH_STARTED, "Post", post.id, metadata={"platforms": platforms})

    for pp in targets:
        publish_post_platform(db, pp)

    statuses = [pp.status for pp in post.platforms]
    if all(s == PlatformContentStatus.PUBLISHED for s in statuses):
        post.status = PostStatus.PUBLISHED
        record_audit(db, user_id, AuditAction.PUBLISH_SUCCESS, "Post", post.id)
        if user_id:
            notify(db, user_id, NotificationType.PUBLISHED, "Post published successfully", f"\"{post.idea}\" is now live.", "Post", post.id)
    elif any(s == PlatformContentStatus.PUBLISHED for s in statuses):
        post.status = PostStatus.PARTIALLY_PUBLISHED
        record_audit(db, user_id, AuditAction.PUBLISH_FAILED, "Post", post.id, metadata={"partial": True})
        if user_id:
            failed = [pp.platform.value for pp in post.platforms if pp.status == PlatformContentStatus.FAILED]
            notify(
                db,
                user_id,
                NotificationType.PUBLISH_FAILED,
                "Post partially published",
                f"\"{post.idea}\" was published, but failed on {', '.join(failed)}. Open the post to retry.",
                "Post",
                post.id,
            )
    else:
        post.status = PostStatus.FAILED
        record_audit(db, user_id, AuditAction.PUBLISH_FAILED, "Post", post.id)
        if user_id:
            notify(db, user_id, NotificationType.PUBLISH_FAILED, "Publishing unsuccessful", f"We couldn't publish \"{post.idea}\". Open the post to review the error and retry.", "Post", post.id)

    db.commit()
    db.refresh(post)
    return post
