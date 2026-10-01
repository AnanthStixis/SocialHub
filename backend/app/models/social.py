from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum as SAEnum, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from app.models.enums import Platform, SocialAccountStatus, TokenStatus


class SocialAccount(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "social_accounts"

    platform: Mapped[Platform] = mapped_column(SAEnum(Platform), nullable=False, index=True)
    account_name: Mapped[str] = mapped_column(String(255), nullable=False)
    external_account_id: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[SocialAccountStatus] = mapped_column(
        SAEnum(SocialAccountStatus), default=SocialAccountStatus.DISCONNECTED, nullable=False
    )
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    connected_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"))

    token: Mapped["SocialAccountToken"] = relationship(
        back_populates="account", uselist=False, cascade="all, delete-orphan"
    )


class SocialAccountToken(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "social_account_tokens"

    social_account_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("social_accounts.id"), nullable=False, unique=True
    )
    encrypted_access_token: Mapped[str] = mapped_column(Text, nullable=False)
    encrypted_refresh_token: Mapped[str | None] = mapped_column(Text)
    token_status: Mapped[TokenStatus] = mapped_column(SAEnum(TokenStatus), default=TokenStatus.VALID, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    account: Mapped["SocialAccount"] = relationship(back_populates="token")
