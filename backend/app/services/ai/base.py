from abc import ABC, abstractmethod
from pydantic import BaseModel


class PlatformContent(BaseModel):
    content: str
    hashtags: list[str] = []


class AIProvider(ABC):
    """Abstraction over any LLM backend used for content generation.

    Implementations must return structured, platform-keyed JSON so callers
    never depend on a specific provider's response shape.
    """

    @abstractmethod
    def generate_platform_content(
        self,
        *,
        topic: str,
        objective: str | None,
        audience: str | None,
        brand_voice: str | None,
        tone: str | None,
        keywords: str | None,
        cta: str | None,
        language: str,
        platforms: list[str],
        platform_instructions: dict[str, str],
        instruction: str | None = None,
        existing_content: str | None = None,
    ) -> dict[str, PlatformContent]:
        """Generate content for one or more platforms in a single call."""
        raise NotImplementedError
