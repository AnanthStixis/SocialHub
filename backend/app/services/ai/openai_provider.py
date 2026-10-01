import json
import httpx
from app.core.config import get_settings
from app.services.ai.base import AIProvider, PlatformContent

settings = get_settings()


class OpenAIProvider(AIProvider):
    """Calls any OpenAI-compatible chat completions endpoint and enforces a
    structured JSON response keyed by platform name."""

    def __init__(self, api_key: str | None = None, base_url: str | None = None, model: str | None = None):
        self.api_key = api_key or settings.OPENAI_API_KEY
        self.base_url = base_url or settings.OPENAI_BASE_URL
        self.model = model or settings.OPENAI_MODEL

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
        system_prompt = (
            "You are a professional social media copywriter. Generate platform-specific content. "
            "Respond ONLY with a JSON object where each key is a platform name (uppercase) and the value is "
            '{"content": string, "hashtags": string[]}. Do not include any other text.'
        )

        instructions_block = "\n".join(
            f"- {platform}: {platform_instructions.get(platform, '')}" for platform in platforms
        )

        user_prompt = f"""
Topic/idea: {topic}
Objective: {objective or "N/A"}
Target audience: {audience or "N/A"}
Brand voice: {brand_voice or "N/A"}
Tone: {tone or "N/A"}
Keywords: {keywords or "N/A"}
Call to action: {cta or "N/A"}
Language: {language}
Platforms to generate for: {", ".join(platforms)}

Per-platform style guidance:
{instructions_block}
"""
        if existing_content:
            user_prompt += f"\nExisting content to revise:\n{existing_content}\n"
        if instruction:
            user_prompt += f"\nRevision instruction: {instruction}\n"

        response = httpx.post(
            f"{self.base_url.rstrip('/')}/chat/completions",
            headers={"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"},
            json={
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.7,
            },
            timeout=60.0,
        )
        response.raise_for_status()
        payload = response.json()
        raw_content = payload["choices"][0]["message"]["content"]
        parsed = json.loads(raw_content)

        result: dict[str, PlatformContent] = {}
        for platform in platforms:
            entry = parsed.get(platform) or parsed.get(platform.lower()) or {}
            result[platform] = PlatformContent(
                content=entry.get("content", ""),
                hashtags=entry.get("hashtags", []),
            )
        return result
