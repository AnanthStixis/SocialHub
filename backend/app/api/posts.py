from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session, selectinload
from app.db.session import get_db
from app.core.deps import get_current_user, require_roles, STAFF_ROLES
from app.models.post import Post, PostPlatform
from app.models.ai import AIGeneration, AIGenerationVersion
from app.models.workflow import ScheduledPost, PublishingJob
from app.models.social import SocialAccount
from app.models.user import User
from app.models.enums import Platform, PostStatus, PlatformContentStatus, SocialAccountStatus, RoleName, AuditAction
from app.schemas.post import (
    PostCreate,
    PostUpdate,
    PostOut,
    PlatformContentUpdate,
    GenerateRequest,
    RegenerateRequest,
    PublishRequest,
    ScheduleRequest,
    PlatformAccountsUpdate,
)
from app.schemas.pagination import Page
from app.services.ai import get_ai_provider
from app.services.prompts import get_platform_instructions
from app.services.versioning import snapshot_post
from app.services.audit import record_audit
from app.services.publishing import publish_post
from app.services.notifications import notify
from app.models.enums import NotificationType

router = APIRouter(prefix="/api/posts", tags=["posts"])


def _get_post_or_404(db: Session, post_id: str) -> Post:
    post = db.scalar(
        select(Post)
        .options(selectinload(Post.platforms), selectinload(Post.media_assets))
        .where(Post.id == post_id, Post.deleted_at.is_(None))
    )
    if not post:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "POST_NOT_FOUND", "message": "Post not found"}},
        )
    return post


def apply_post_filters(query, status_filter=None, created_by=None, platform=None, search=None, date_from=None, date_to=None):
    query = query.where(Post.deleted_at.is_(None))
    if search and search.strip():
        term = f"%{search.strip().replace('%', '').replace('_', '')}%"
        query = query.where(
            Post.idea.ilike(term)
            | Post.id.in_(select(PostPlatform.post_id).where(PostPlatform.content.ilike(term)))
        )
    if date_from:
        query = query.where(Post.created_at >= date_from)
    if date_to:
        query = query.where(Post.created_at < date_to)
    if status_filter:
        query = query.where(Post.status == status_filter)
    if created_by:
        query = query.where(Post.created_by == created_by)
    if platform:
        query = query.where(Post.id.in_(select(PostPlatform.post_id).where(PostPlatform.platform == platform)))
    return query


@router.get("", response_model=Page[PostOut])
def list_posts(
    status_filter: str | None = Query(default=None, alias="status"),
    created_by: str | None = None,
    platform: str | None = None,
    search: str | None = Query(default=None, max_length=100),
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=15, ge=1, le=100),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    query = apply_post_filters(select(Post), status_filter, created_by, platform, search, date_from, date_to)

    total = db.scalar(select(func.count()).select_from(query.with_only_columns(Post.id).distinct().subquery()))

    query = (
        query.options(selectinload(Post.platforms))
        .order_by(Post.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = db.scalars(query).unique().all()
    return Page(items=items, total=total or 0, page=page, page_size=page_size)


@router.post(
    "",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def create_post(payload: PostCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        platform_enums = [Platform(p) for p in payload.platforms]
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_PLATFORM", "message": "One or more platforms are invalid"}},
        )

    post = Post(
        idea=payload.idea,
        creation_mode=payload.creation_mode,
        target_audience=payload.target_audience,
        objective=payload.objective,
        brand_voice=payload.brand_voice,
        tone=payload.tone,
        keywords=payload.keywords,
        language=payload.language,
        cta=payload.cta,
        created_by=current_user.id,
        status=PostStatus.DRAFT,
    )
    db.add(post)
    db.flush()

    manual_content = payload.manual_content or {}
    for platform in platform_enums:
        content = manual_content.get(platform.value)
        db.add(
            PostPlatform(
                post_id=post.id,
                platform=platform,
                content=content,
                hashtags=[],
                status=PlatformContentStatus.EDITED if content else PlatformContentStatus.PENDING,
            )
        )

    db.commit()
    record_audit(db, current_user.id, AuditAction.POST_CREATED, "Post", post.id)
    return _get_post_or_404(db, post.id)


@router.get("/{post_id}", response_model=PostOut)
def get_post(post_id: str, db: Session = Depends(get_db), _=Depends(get_current_user)):
    return _get_post_or_404(db, post_id)


@router.put(
    "/{post_id}",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def update_post(post_id: str, payload: PostUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = _get_post_or_404(db, post_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(post, field, value)
    snapshot_post(db, post, "Post details edited", current_user.id)
    db.commit()
    record_audit(db, current_user.id, AuditAction.POST_EDITED, "Post", post.id)
    return _get_post_or_404(db, post.id)


@router.delete(
    "/{post_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def delete_post(post_id: str, db: Session = Depends(get_db)):
    from datetime import datetime, timezone

    post = _get_post_or_404(db, post_id)
    post.deleted_at = datetime.now(timezone.utc)
    db.commit()


@router.put(
    "/{post_id}/platforms/{platform}",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def update_platform_content(
    post_id: str,
    platform: str,
    payload: PlatformContentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)
    matching_rows = [p for p in post.platforms if p.platform.value == platform]
    if not matching_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "PLATFORM_NOT_FOUND", "message": "Platform not found on this post"}},
        )
    for pp in matching_rows:
        pp.content = payload.content
        pp.hashtags = payload.hashtags
        pp.status = PlatformContentStatus.EDITED
    snapshot_post(db, post, f"{platform} content edited", current_user.id)
    db.commit()
    record_audit(db, current_user.id, AuditAction.POST_EDITED, "PostPlatform", pp.id)
    return _get_post_or_404(db, post.id)


@router.post(
    "/{post_id}/platforms/{platform}",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def add_platform(post_id: str, platform: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Re-include a platform on this post (e.g. after removing it) — a post
    targets every connected platform by default, and this is how you bring
    one back if you'd excluded it."""
    post = _get_post_or_404(db, post_id)
    try:
        platform_enum = Platform(platform.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_PLATFORM", "message": f"Unknown platform: {platform}"}},
        )
    if any(p.platform == platform_enum for p in post.platforms):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "PLATFORM_EXISTS", "message": "This platform is already included on the post"}},
        )
    db.add(PostPlatform(post_id=post.id, platform=platform_enum, content=None, hashtags=[], status=PlatformContentStatus.PENDING))
    db.commit()
    record_audit(db, current_user.id, AuditAction.POST_EDITED, "Post", post.id, metadata={"added_platform": platform_enum.value})
    return _get_post_or_404(db, post.id)


@router.delete(
    "/{post_id}/platforms/{platform}",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def remove_platform(post_id: str, platform: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Exclude a platform from this post — it targets every connected
    platform by default, so this is how you customize an individual post to
    only some of them. A post must always keep at least one platform."""
    post = _get_post_or_404(db, post_id)
    try:
        platform_enum = Platform(platform.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_PLATFORM", "message": f"Unknown platform: {platform}"}},
        )
    remaining_platforms = {p.platform for p in post.platforms} - {platform_enum}
    if not remaining_platforms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "LAST_PLATFORM", "message": "A post must target at least one platform"}},
        )
    rows_to_remove = [p for p in post.platforms if p.platform == platform_enum]
    has_publishing_history = db.scalar(
        select(func.count())
        .select_from(PublishingJob)
        .where(PublishingJob.post_platform_id.in_([p.id for p in rows_to_remove]))
    )
    if has_publishing_history:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "HAS_PUBLISHING_HISTORY",
                    "message": f"{platform_enum.value.title()} already has publishing history on this post and can't be removed. Clear its content instead if you don't want to publish to it again.",
                },
            },
        )
    for pp in rows_to_remove:
        db.delete(pp)
    db.commit()
    record_audit(db, current_user.id, AuditAction.POST_EDITED, "Post", post.id, metadata={"removed_platform": platform_enum.value})
    return _get_post_or_404(db, post.id)


@router.put(
    "/{post_id}/platforms/{platform}/accounts",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def set_platform_accounts(
    post_id: str,
    platform: str,
    payload: PlatformAccountsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Choose which connected account(s) this platform's content publishes
    to — a specific Page/account, several, or all of them (pass null for
    "all currently connected"). Reconciles the post_platforms rows for this
    platform to match, carrying over existing content/hashtags so newly
    added rows aren't blank."""
    post = _get_post_or_404(db, post_id)
    try:
        platform_enum = Platform(platform.upper())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_PLATFORM", "message": f"Unknown platform: {platform}"}},
        )

    if payload.social_account_ids is None:
        target_ids = list(
            db.scalars(
                select(SocialAccount.id).where(
                    SocialAccount.platform == platform_enum,
                    SocialAccount.status == SocialAccountStatus.CONNECTED,
                    SocialAccount.deleted_at.is_(None),
                )
            )
        )
    else:
        target_ids = payload.social_account_ids

    existing_rows = [p for p in post.platforms if p.platform == platform_enum]
    template = existing_rows[0] if existing_rows else None
    matched_rows: dict[str, PostPlatform] = {}
    unbound_rows: list[PostPlatform] = []
    for row in existing_rows:
        if row.social_account_id and row.social_account_id in target_ids and row.social_account_id not in matched_rows:
            matched_rows[row.social_account_id] = row
        else:
            unbound_rows.append(row)

    # Reuse leftover rows (legacy unbound rows, or ones targeting a
    # now-deselected account) for any still-unfilled target account before
    # creating new ones, so content/hashtags carry over and nothing is
    # ever duplicated.
    for account_id in target_ids:
        if account_id in matched_rows:
            continue
        if unbound_rows:
            row = unbound_rows.pop()
            row.social_account_id = account_id
            matched_rows[account_id] = row
        else:
            new_row = PostPlatform(
                post_id=post.id,
                platform=platform_enum,
                content=template.content if template else None,
                hashtags=template.hashtags if template else [],
                status=template.status if template else PlatformContentStatus.PENDING,
                social_account_id=account_id,
            )
            db.add(new_row)
            matched_rows[account_id] = new_row

    # Anything left over targets an account no longer selected — drop it,
    # unless it's the post's only row for this platform (keep at least one
    # placeholder row so the platform tab doesn't disappear).
    for row in unbound_rows:
        if len(matched_rows) == 0 and row is unbound_rows[-1]:
            row.social_account_id = None
            continue
        db.delete(row)

    db.commit()
    return _get_post_or_404(db, post.id)


@router.post(
    "/{post_id}/generate",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def generate_content(
    post_id: str,
    payload: GenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)
    if payload.topic:
        post.idea = payload.topic
        post.creation_mode = "AI"
    target_platforms = payload.platforms or [p.platform.value for p in post.platforms]
    target_platforms = [p for p in target_platforms if p in [pp.platform.value for pp in post.platforms]]
    if not target_platforms:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "NO_PLATFORMS", "message": "No matching platforms on this post"}},
        )

    instructions = get_platform_instructions(db, target_platforms)
    provider = get_ai_provider(db)
    generated = provider.generate_platform_content(
        topic=post.idea,
        objective=post.objective,
        audience=post.target_audience,
        brand_voice=post.brand_voice,
        tone=post.tone,
        keywords=post.keywords,
        cta=post.cta,
        language=post.language,
        platforms=target_platforms,
        platform_instructions=instructions,
    )

    generation = AIGeneration(
        post_id=post.id,
        requested_by=current_user.id,
        provider="demo" if provider.__class__.__name__ == "DemoAIProvider" else "openai",
        model=None,
        input_payload={
            "topic": post.idea,
            "objective": post.objective,
            "audience": post.target_audience,
            "platforms": target_platforms,
        },
        raw_response=None,
    )
    db.add(generation)
    db.flush()

    for platform, platform_content in generated.items():
        # A platform can target multiple accounts (e.g. several Facebook
        # Pages) — apply the same generated content to every row for it.
        # Hashtags are always user-entered, never overwritten by AI.
        matching_rows = [p for p in post.platforms if p.platform.value == platform]
        for pp in matching_rows:
            pp.content = platform_content.content
            pp.status = PlatformContentStatus.GENERATED
        db.add(
            AIGenerationVersion(
                generation_id=generation.id,
                platform=platform,
                content=platform_content.content,
                hashtags=platform_content.hashtags,
                version_number=1,
            )
        )

    post.creation_mode = "AI"
    snapshot_post(db, post, "AI generated", current_user.id)
    notify(
        db,
        current_user.id,
        NotificationType.CONTENT_GENERATED,
        "AI draft ready for review",
        f"Your AI-generated content for \"{post.idea}\" is ready for {', '.join(target_platforms)}.",
        "Post",
        post.id,
    )
    db.commit()
    record_audit(db, current_user.id, AuditAction.AI_GENERATED, "Post", post.id, metadata={"platforms": target_platforms})
    return _get_post_or_404(db, post.id)


@router.post(
    "/{post_id}/regenerate",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def regenerate_content(
    post_id: str,
    payload: RegenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)
    matching_rows = [p for p in post.platforms if p.platform.value == payload.platform]
    if not matching_rows:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"success": False, "error": {"code": "PLATFORM_NOT_FOUND", "message": "Platform not found on this post"}},
        )

    instructions = get_platform_instructions(db, [payload.platform])
    provider = get_ai_provider(db)
    generated = provider.generate_platform_content(
        topic=post.idea,
        objective=post.objective,
        audience=post.target_audience,
        brand_voice=post.brand_voice,
        tone=post.tone,
        keywords=post.keywords,
        cta=post.cta,
        language=post.language,
        platforms=[payload.platform],
        platform_instructions=instructions,
        instruction=payload.instruction,
        existing_content=matching_rows[0].content,
    )

    generation = AIGeneration(
        post_id=post.id,
        requested_by=current_user.id,
        provider="demo" if provider.__class__.__name__ == "DemoAIProvider" else "openai",
        input_payload={"platform": payload.platform, "instruction": payload.instruction},
        raw_response=None,
    )
    db.add(generation)
    db.flush()

    platform_content = generated[payload.platform]
    for pp in matching_rows:
        pp.content = platform_content.content
        pp.hashtags = platform_content.hashtags
        pp.status = PlatformContentStatus.GENERATED
    db.add(
        AIGenerationVersion(
            generation_id=generation.id,
            platform=payload.platform,
            content=platform_content.content,
            hashtags=platform_content.hashtags,
            instruction=payload.instruction,
            version_number=1,
        )
    )

    snapshot_post(db, post, f"{payload.platform} regenerated: {payload.instruction or 'no instruction'}", current_user.id)
    db.commit()
    record_audit(db, current_user.id, AuditAction.AI_GENERATED, "PostPlatform", pp.id, metadata={"instruction": payload.instruction})
    return _get_post_or_404(db, post.id)


@router.post(
    "/{post_id}/publish",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def publish_now(
    post_id: str,
    payload: PublishRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)
    if post.status in (PostStatus.PUBLISHED,):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "ALREADY_PUBLISHED", "message": "This post has already been published"}},
        )
    missing_content = [
        p.platform.value
        for p in post.platforms
        if (payload.platforms is None or p.platform.value in payload.platforms) and not p.content
    ]
    if missing_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "MISSING_CONTENT",
                    "message": f"These platforms have no content to publish: {', '.join(missing_content)}",
                },
            },
        )

    for sp in post.scheduled_posts:
        if not sp.cancelled:
            sp.cancelled = True

    post = publish_post(db, post, payload.platforms, current_user.id)
    return _get_post_or_404(db, post.id)


@router.post(
    "/{post_id}/schedule",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def schedule_post(
    post_id: str,
    payload: ScheduleRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    post = _get_post_or_404(db, post_id)
    if post.status == PostStatus.PUBLISHED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "ALREADY_PUBLISHED", "message": "This post has already been published"}},
        )
    if payload.scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "INVALID_SCHEDULE_TIME", "message": "Scheduled time must be in the future"}},
        )
    missing_content = [p.platform.value for p in post.platforms if not p.content]
    if missing_content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "success": False,
                "error": {
                    "code": "MISSING_CONTENT",
                    "message": f"These platforms have no content to schedule: {', '.join(missing_content)}",
                },
            },
        )

    for sp in post.scheduled_posts:
        if not sp.cancelled:
            sp.cancelled = True

    db.add(
        ScheduledPost(
            post_id=post.id,
            scheduled_at=payload.scheduled_at,
            timezone=payload.timezone,
            created_by=current_user.id,
        )
    )
    post.status = PostStatus.SCHEDULED
    notify(
        db,
        current_user.id,
        NotificationType.SCHEDULED,
        "Post scheduled",
        f"\"{post.idea}\" will be published on {payload.scheduled_at.strftime('%b %d, %Y at %H:%M')} ({payload.timezone}).",
        "Post",
        post.id,
    )
    db.commit()
    record_audit(db, current_user.id, AuditAction.SCHEDULED, "Post", post.id, metadata={"scheduled_at": payload.scheduled_at.isoformat()})
    return _get_post_or_404(db, post.id)


@router.post(
    "/{post_id}/cancel",
    response_model=PostOut,
    dependencies=[Depends(require_roles(*STAFF_ROLES))],
)
def cancel_schedule(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = _get_post_or_404(db, post_id)
    if post.status != PostStatus.SCHEDULED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"success": False, "error": {"code": "NOT_SCHEDULED", "message": "This post is not currently scheduled"}},
        )
    for sp in post.scheduled_posts:
        if not sp.cancelled:
            sp.cancelled = True
    post.status = PostStatus.DRAFT
    db.commit()
    return _get_post_or_404(db, post.id)
