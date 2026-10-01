"""Convert rich-text (HTML) post content to plain text for publishing.

Facebook, Instagram and LinkedIn APIs accept plain text only, so the editor's
HTML is flattened here: paragraphs and lists become line breaks / bullets,
links become "text (url)", and bold/italic are mapped to Unicode styled
characters, which render as emphasis on all three platforms. Content that
contains no HTML tags (older posts, AI-generated text) passes through unchanged.
"""
import re
from html.parser import HTMLParser

_HTML_TAG = re.compile(r"</?(p|br|strong|em|b|i|u|ul|ol|li|a|div|span|h[1-6])\b", re.IGNORECASE)

_BOLD_UPPER, _BOLD_LOWER, _BOLD_DIGIT = 0x1D5D4, 0x1D5EE, 0x1D7EC  # sans-serif bold
_ITALIC_UPPER, _ITALIC_LOWER = 0x1D608, 0x1D622  # sans-serif italic


def _bold(ch: str) -> str:
    if "A" <= ch <= "Z":
        return chr(_BOLD_UPPER + ord(ch) - 65)
    if "a" <= ch <= "z":
        return chr(_BOLD_LOWER + ord(ch) - 97)
    if "0" <= ch <= "9":
        return chr(_BOLD_DIGIT + ord(ch) - 48)
    return ch


def _italic(ch: str) -> str:
    if "A" <= ch <= "Z":
        return chr(_ITALIC_UPPER + ord(ch) - 65)
    if "a" <= ch <= "z":
        return chr(_ITALIC_LOWER + ord(ch) - 97)
    return ch


class _Flattener(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.bold = 0
        self.italic = 0
        self.lists: list[dict] = []
        self.href: str | None = None
        self.link_text = ""

    def _break(self, n: int = 2) -> None:
        text = "".join(self.parts)
        if not text:
            return
        trailing = len(text) - len(text.rstrip("\n"))
        if trailing < n:
            self.parts.append("\n" * (n - trailing))

    def handle_starttag(self, tag, attrs):
        if tag in ("strong", "b"):
            self.bold += 1
        elif tag in ("em", "i"):
            self.italic += 1
        elif tag == "br":
            self.parts.append("\n")
        elif tag in ("p", "div") or (len(tag) == 2 and tag[0] == "h" and tag[1].isdigit()):
            self._break()
        elif tag in ("ul", "ol"):
            self._break(1 if self.lists else 2)
            self.lists.append({"ordered": tag == "ol", "n": 0})
        elif tag == "li":
            self._break(1)
            if self.lists:
                item = self.lists[-1]
                item["n"] += 1
                self.parts.append(f"{item['n']}. " if item["ordered"] else "• ")
        elif tag == "a":
            self.href = dict(attrs).get("href")
            self.link_text = ""

    def handle_endtag(self, tag):
        if tag in ("strong", "b"):
            self.bold = max(0, self.bold - 1)
        elif tag in ("em", "i"):
            self.italic = max(0, self.italic - 1)
        elif tag in ("p", "div") or (len(tag) == 2 and tag[0] == "h" and tag[1].isdigit()):
            self._break()
        elif tag in ("ul", "ol"):
            if self.lists:
                self.lists.pop()
            self._break(1 if self.lists else 2)
        elif tag == "a":
            href = self.href
            if href and href.strip() and href.strip() != self.link_text.strip():
                self.parts.append(f" ({href.strip()})")
            self.href = None

    def handle_data(self, data):
        if not data.strip("\n") and "\n" in data:
            return  # formatting whitespace between block tags
        text = data.replace("\n", " ")
        if self.bold:
            text = "".join(_bold(c) for c in text)
        elif self.italic:
            text = "".join(_italic(c) for c in text)
        self.parts.append(text)
        if self.href is not None:
            self.link_text += data


def to_plain_text(content: str | None) -> str:
    if not content or not _HTML_TAG.search(content):
        return content or ""
    parser = _Flattener()
    parser.feed(content)
    parser.close()
    return re.sub(r"\n{3,}", "\n\n", "".join(parser.parts)).strip()
