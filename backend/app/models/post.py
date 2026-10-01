from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, Enum as SAEnum, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from app.models.enums import PostStatus, Platform, PlatformContentStatus


class Post(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "posts"

    idea: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[PostStatus] = mapped_column(SAEnum(PostStatus), default=PostStatus.DRAFT, nullable=False, index=True)
    creation_mode: Mapped[str] = mapped_column(String(20), default="MANUAL")  # MANUAL | AI
    target_audience: Mapped[str | None] = mapped_column(String(500))
    objective: Mapped[str | None] = mapped_column(String(500))
    brand_voice: Mapped[str | None] = mapped_column(String(255))
    tone: Mapped[str | None] = mapped_column(String(255))
    keywords: Mapped[str | None] = mapped_column(String(500))
    language: Mapped[str] = mapped_column(String(50), default="English")
    cta: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)

    platforms: Mapped[list["PostPlatform"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    versions: Mapped[list["PostVersion"]] = relationship(back_populates="post", cascade="all, delete-orphan")
    scheduled_posts: Mapped[list["ScheduledPost"]] = relationship(
        back_populates="post", cascade="all, delete-orphan", order_by="ScheduledPost.created_at.desc()"
    )
    media_assets: Mapped[list["MediaAsset"]] = relationship(
        back_populates="post", cascade="all, delete-orphan", order_by="MediaAsset.order_index"
    )

    @property
    def scheduled_at(self) -> datetime | None:
        active = next((s for s in self.scheduled_posts if not s.cancelled), None)
        return active.scheduled_at if active else None

    @property
    def scheduled_timezone(self) -> str | None:
        active = next((s for s in self.scheduled_posts if not s.cancelled), None)
        return active.timezone if active else None


class PostPlatform(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "post_platforms"

    post_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("posts.id"), nullable=False, index=True)
    platform: Mapped[Platform] = mapped_column(SAEnum(Platform), nullable=False, index=True)
    content: Mapped[str | None] = mapped_column(Text)
    hashtags: Mapped[list | None] = mapped_column(JSONB, default=list)
    status: Mapped[PlatformContentStatus] = mapped_column(
        SAEnum(PlatformContentStatus), default=PlatformContentStatus.PENDING, nullable=False
    )
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    external_post_id: Mapped[str | None] = mapped_column(String(255))
    error_message: Mapped[str | None] = mapped_column(Text)
    social_account_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("social_accounts.id"))
    likes_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    comments_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0", nullable=False)
    engagement_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    post: Mapped["Post"] = relationship(back_populates="platforms")
    social_account: Mapped["SocialAccount | None"] = relationship()


class PostVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "post_versions"

    post_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("posts.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSONB, nullable=False)
    reason: Mapped[str | None] = mapped_column(String(255))
    created_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))

    post: Mapped["Post"] = relationship(back_populates="versions")
