from app.services.ai.base import AIProvider, PlatformContent

PLATFORM_STYLE = {
    "FACEBOOK": {
        "prefix": "",
        "suffix_lines": 2,
        "hashtag_count": 3,
        "emoji": False,
    },
    "INSTAGRAM": {
        "prefix": "",
        "suffix_lines": 1,
        "hashtag_count": 6,
        "emoji": True,
    },
    "LINKEDIN": {
        "prefix": "",
        "suffix_lines": 3,
        "hashtag_count": 2,
        "emoji": False,
    },
}


def _keyword_hashtags(keywords: str | None, count: int) -> list[str]:
    words = [w.strip() for w in (keywords or "").replace(",", " ").split() if w.strip()]
    tags = ["#" + "".join(ch for ch in w if ch.isalnum()) for w in words][:count]
    while len(tags) < count:
        tags.append(f"#Topic{len(tags) + 1}")
    return tags


class DemoAIProvider(AIProvider):
    """Deterministic, offline content generator used when DEMO_MODE is enabled
    or no OPENAI_API_KEY is configured, so the full workflow stays testable."""

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
        result: dict[str, PlatformContent] = {}
        cta_text = cta or "Learn more"

        for platform in platforms:
            style = PLATFORM_STYLE.get(platform, PLATFORM_STYLE["FACEBOOK"])
            hashtags = _keyword_hashtags(keywords, style["hashtag_count"])

            if platform == "INSTAGRAM":
                hook = f"{'✨ ' if style['emoji'] else ''}{topic}"
                body = (
                    f"{hook}\n\n"
                    f"{tone or 'Engaging'} take for {audience or 'our community'}: "
                    f"{objective or 'why this matters right now'}.\n\n"
                    f"{cta_text} {'👉' if style['emoji'] else ''}"
                )
            elif platform == "LINKEDIN":
                body = (
                    f"{topic}\n\n"
                    f"For {audience or 'industry leaders'}, this is about {objective or 'driving measurable outcomes'}.\n\n"
                    f"In a {tone or 'professional'} voice: organizations that act on this see compounding advantages "
                    f"over time, particularly when paired with disciplined execution.\n\n"
                    f"{cta_text}."
                )
            else:  # FACEBOOK and any future default
                body = (
                    f"{topic} — {objective or 'here is what you need to know'}.\n\n"
                    f"Written for {audience or 'our audience'} in a {tone or 'friendly'} tone. "
                    f"{cta_text}!"
                )

            if instruction and existing_content:
                body = f"{existing_content}\n\n[Revised — {instruction}]"
            elif instruction:
                body = f"{body}\n\n[Generated with instruction: {instruction}]"

            result[platform] = PlatformContent(content=body, hashtags=hashtags)

        return result
