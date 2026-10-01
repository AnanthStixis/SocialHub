from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from app.db.session import Base
from app.models.base import UUIDMixin, TimestampMixin


class SystemSetting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    value: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    description: Mapped[str | None] = mapped_column(Text)


class BrandSetting(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "brand_settings"

    brand_name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    website: Mapped[str | None] = mapped_column(String(500))
    industry: Mapped[str | None] = mapped_column(String(255))
    target_audience: Mapped[str | None] = mapped_column(String(500))
    brand_voice: Mapped[str | None] = mapped_column(String(255))
    tone: Mapped[str | None] = mapped_column(String(255))
    preferred_language: Mapped[str] = mapped_column(String(50), default="English")
    forbidden_words: Mapped[str | None] = mapped_column(Text)
    preferred_hashtags: Mapped[str | None] = mapped_column(Text)
    default_cta: Mapped[str | None] = mapped_column(String(255))


class EmailTemplate(Base, UUIDMixin, TimestampMixin):
    """Singleton row: the look and wording of the team-invitation email."""

    __tablename__ = "email_templates"

    brand_name: Mapped[str] = mapped_column(String(100), default="Feedwren")
    logo_file: Mapped[str | None] = mapped_column(String(255))
    accent_color: Mapped[str] = mapped_column(String(20), default="#0f766e")
    subject: Mapped[str] = mapped_column(String(255))
    heading: Mapped[str] = mapped_column(String(255))
    intro: Mapped[str] = mapped_column(Text)
    bullets: Mapped[list] = mapped_column(JSONB, default=list)
    instructions: Mapped[str] = mapped_column(Text)
    button_text: Mapped[str] = mapped_column(String(100), default="Accept invitation")
    expiry_note: Mapped[str] = mapped_column(String(255))
    footer: Mapped[str] = mapped_column(String(255))
