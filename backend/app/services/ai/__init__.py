from sqlalchemy.orm import Session
from app.services.ai.base import AIProvider, PlatformContent
from app.services.ai.demo_provider import DemoAIProvider
from app.services.ai.openai_provider import OpenAIProvider
from app.services.ai_credentials import StoredKeyUnreadableError, get_openai_config


def get_ai_provider(db: Session | None = None) -> AIProvider:
    """Uses a real OpenAI-compatible provider whenever an API key is
    configured (via Settings -> AI Provider, or OPENAI_API_KEY in .env),
    independent of DEMO_MODE — DEMO_MODE only governs social publishing,
    not content generation. Falls back to the offline demo generator when
    no key is configured, so the workflow still works with zero setup."""
    if db is not None:
        try:
            config = get_openai_config(db)
        except StoredKeyUnreadableError:
            config = None
        if config:
            api_key, base_url, model = config
            return OpenAIProvider(api_key, base_url, model)
    return DemoAIProvider()


__all__ = ["AIProvider", "PlatformContent", "get_ai_provider"]
