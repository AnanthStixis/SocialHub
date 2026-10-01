"""Seed the admin role/user and default settings. Run with: python -m app.db.seed"""
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.user import User, Role, UserRole
from app.models.enums import RoleName
from app.models.system import BrandSetting
from app.models.ai import PromptTemplate
from app.core.security import hash_password


def seed() -> None:
    db = SessionLocal()
    try:
        admin_role = db.scalar(select(Role).where(Role.name == RoleName.ADMIN))
        if not admin_role:
            admin_role = Role(name=RoleName.ADMIN, description="Administrator")
            db.add(admin_role)
            db.flush()

        if not db.scalar(select(Role).where(Role.name == RoleName.PUBLISHER)):
            db.add(Role(name=RoleName.PUBLISHER, description="Publisher"))
            db.flush()

        admin_email = "admin@example.com"
        admin = db.scalar(select(User).where(User.email == admin_email))
        if not admin:
            admin = User(email=admin_email, full_name="Admin User", hashed_password=hash_password("Admin@12345"))
            db.add(admin)
            db.flush()
            db.add(UserRole(user_id=admin.id, role_id=admin_role.id))

        if not db.scalar(select(BrandSetting)):
            db.add(
                BrandSetting(
                    brand_name="Acme Corporation",
                    description="A modern technology company",
                    industry="Software",
                    target_audience="Software engineering leaders",
                    brand_voice="Confident, helpful, and innovative",
                    tone="Professional",
                    preferred_language="English",
                    default_cta="Learn more",
                )
            )

        default_prompts = {
            "FACEBOOK": "Write a conversational, moderately long Facebook post with a strong CTA and relevant hashtags.",
            "INSTAGRAM": "Write a short, visual-friendly Instagram caption with a hook, tasteful emojis, hashtags, and a CTA.",
            "LINKEDIN": "Write a professional, thought-leadership style LinkedIn post with structured paragraphs, industry terminology, limited hashtags, and a professional CTA.",
        }
        for platform, instructions in default_prompts.items():
            existing = db.scalar(select(PromptTemplate).where(PromptTemplate.platform == platform))
            if not existing:
                db.add(
                    PromptTemplate(
                        platform=platform,
                        name=f"{platform.title()} Default",
                        system_prompt="You are a professional social media copywriter generating platform-specific content.",
                        instructions=instructions,
                    )
                )

        db.commit()
        print("Seed complete.")
        print("Admin login: admin@example.com / Admin@12345")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
