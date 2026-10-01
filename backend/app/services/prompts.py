from sqlalchemy import select
from sqlalchemy.orm import Session
from app.models.ai import PromptTemplate

DEFAULT_INSTRUCTIONS = {
    "FACEBOOK": "Conversational, moderate length, strong engagement hook, clear CTA, 2-3 hashtags.",
    "INSTAGRAM": "Short, visual-friendly caption, strong opening hook, tasteful emojis, CTA, 4-6 hashtags.",
    "LINKEDIN": "Professional, thought-leadership tone, structured paragraphs, industry terminology, professional CTA, 1-2 hashtags.",
}


def get_platform_instructions(db: Session, platforms: list[str]) -> dict[str, str]:
    templates = db.scalars(
        select(PromptTemplate).where(PromptTemplate.platform.in_(platforms), PromptTemplate.is_active.is_(True))
    ).all()
    instructions = {t.platform: t.instructions or DEFAULT_INSTRUCTIONS.get(t.platform, "") for t in templates}
    for platform in platforms:
        instructions.setdefault(platform, DEFAULT_INSTRUCTIONS.get(platform, "Write engaging, on-brand content."))
    return instructions
