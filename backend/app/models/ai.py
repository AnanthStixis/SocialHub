from sqlalchemy import String, Text, ForeignKey, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.session import Base
from app.models.base import UUIDMixin, TimestampMixin


class AIGeneration(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_generations"

    post_id: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("posts.id"), nullable=False, index=True)
    requested_by: Mapped[str] = mapped_column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    prompt_template_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), ForeignKey("prompt_templates.id"))
    provider: Mapped[str] = mapped_column(String(100), default="openai")
    model: Mapped[str | None] = mapped_column(String(100))
    input_payload: Mapped[dict] = mapped_column(JSONB, nullable=False)
    raw_response: Mapped[dict | None] = mapped_column(JSONB)

    versions: Mapped[list["AIGenerationVersion"]] = relationship(
        back_populates="generation", cascade="all, delete-orphan"
    )


class AIGenerationVersion(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "ai_generation_versions"

    generation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("ai_generations.id"), nullable=False, index=True
    )
    platform: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    hashtags: Mapped[list | None] = mapped_column(JSONB, default=list)
    instruction: Mapped[str | None] = mapped_column(Text)
    version_number: Mapped[int] = mapped_column(Integer, default=1)

    generation: Mapped["AIGeneration"] = relationship(back_populates="versions")


class PromptTemplate(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "prompt_templates"

    platform: Mapped[str | None] = mapped_column(String(50), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    system_prompt: Mapped[str] = mapped_column(Text, nullable=False)
    instructions: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(default=True)
