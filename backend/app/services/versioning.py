from sqlalchemy import select, func
from sqlalchemy.orm import Session
from app.models.post import Post, PostVersion


def snapshot_post(db: Session, post: Post, reason: str, created_by: str | None) -> PostVersion:
    next_number = (
        db.scalar(select(func.max(PostVersion.version_number)).where(PostVersion.post_id == post.id)) or 0
    ) + 1
    snapshot = {
        "idea": post.idea,
        "status": post.status.value if hasattr(post.status, "value") else post.status,
        "platforms": [
            {
                "platform": pp.platform.value if hasattr(pp.platform, "value") else pp.platform,
                "content": pp.content,
                "hashtags": pp.hashtags,
                "status": pp.status.value if hasattr(pp.status, "value") else pp.status,
            }
            for pp in post.platforms
        ],
    }
    version = PostVersion(
        post_id=post.id,
        version_number=next_number,
        snapshot=snapshot,
        reason=reason,
        created_by=created_by,
    )
    db.add(version)
    return version
