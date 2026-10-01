from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, Enum as SAEnum, DateTime, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.base import UUIDMixin, TimestampMixin
from app.models.enums import (
    Platform,
    PublishingJobStatus,
    NotificationType,
    AuditAction,
)


class ScheduledPost(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "scheduled_posts"

    post_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("posts.id"), nullable=False, index=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    created_by: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    cancelled: Mapped[bool] = mapped_column(Boolean, default=False)

    post: Mapped["Post"] = relationship(back_populates="scheduled_posts")


class PublishingJob(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "publishing_jobs"

    post_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("posts.id"), nullable=False, index=True)
    post_platform_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("post_platforms.id"), nullable=False, index=True
    )
    platform: Mapped[Platform] = mapped_column(SAEnum(Platform), nullable=False, index=True)
    status: Mapped[PublishingJobStatus] = mapped_column(
        SAEnum(PublishingJobStatus), default=PublishingJobStatus.PENDING, nullable=False
    )
    idempotency_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0)
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    next_retry_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    attempts: Mapped[list["PublishingAttempt"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    post: Mapped["Post"] = relationship()
    post_platform: Mapped["PostPlatform"] = relationship()

    @property
    def post_idea(self) -> str | None:
        return self.post.idea if self.post else None

    @property
    def page_name(self) -> str | None:
        account = self.post_platform.social_account if self.post_platform else None
        return account.account_name if account else None


class PublishingAttempt(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "publishing_attempts"

    job_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("publishing_jobs.id"), nullable=False, index=True)
    attempt_number: Mapped[int] = mapped_column(Integer, nullable=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False)
    external_post_id: Mapped[str | None] = mapped_column(String(255))
    error_message: Mapped[str | None] = mapped_column(Text)

    job: Mapped["PublishingJob"] = relationship(back_populates="attempts")


class Notification(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "notifications"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    type: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    entity_type: Mapped[str | None] = mapped_column(String(100))
    entity_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)


class AuditLog(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "audit_logs"

    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), index=True)
    action: Mapped[AuditAction] = mapped_column(SAEnum(AuditAction), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(64))
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, default=dict)
