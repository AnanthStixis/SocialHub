from datetime import datetime
from sqlalchemy import String, Boolean, ForeignKey, Enum as SAEnum, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.base import UUIDMixin, TimestampMixin, SoftDeleteMixin
from app.models.enums import RoleName


class Role(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "roles"

    name: Mapped[RoleName] = mapped_column(SAEnum(RoleName), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(String(255))


class User(Base, UUIDMixin, TimestampMixin, SoftDeleteMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    first_name: Mapped[str | None] = mapped_column(String(100))
    last_name: Mapped[str | None] = mapped_column(String(100))
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False, server_default="false")
    invited_by: Mapped[str | None] = mapped_column(UUID(as_uuid=False))
    invite_token_hash: Mapped[str | None] = mapped_column(String(128), index=True)
    invite_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    invite_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user_roles: Mapped[list["UserRole"]] = relationship(back_populates="user", cascade="all, delete-orphan")

    @property
    def status(self) -> str:
        if not self.is_active:
            return "DISABLED"
        if self.invite_token_hash and not self.invite_accepted_at:
            return "PENDING"
        return "ACTIVE"

    @property
    def role_names(self) -> list[str]:
        return [ur.role.name.value for ur in self.user_roles]


class UserRole(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "user_roles"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    role_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("roles.id"), nullable=False)

    user: Mapped["User"] = relationship(back_populates="user_roles")
    role: Mapped["Role"] = relationship()


class RefreshToken(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
