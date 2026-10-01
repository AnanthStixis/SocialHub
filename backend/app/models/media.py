from sqlalchemy import String, Integer, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin


class MediaAsset(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "media_assets"

    post_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("posts.id"), index=True)
    uploaded_by: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    file_name: Mapped[str] = mapped_column(String(500), nullable=False)
    file_url: Mapped[str] = mapped_column(String(1000), nullable=False)
    media_type: Mapped[str] = mapped_column(String(20), nullable=False)  # image | video
    mime_type: Mapped[str | None] = mapped_column(String(100))
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    post: Mapped["Post"] = relationship(back_populates="media_assets")


class Hashtag(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "hashtags"

    tag: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)


class PostHashtag(Base, UUIDMixin):
    __tablename__ = "post_hashtags"

    post_platform_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("post_platforms.id"), nullable=False, index=True
    )
    hashtag_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("hashtags.id"), nullable=False)
