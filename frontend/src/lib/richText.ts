// Post content is stored as HTML (from the rich-text editor) but every supported
// platform publishes plain text. htmlToPlain mirrors backend/app/services/rich_text.py
// so previews and length checks match exactly what gets published.

const HTML_TAG = /<\/?(p|br|strong|em|b|i|u|ul|ol|li|a|div|span|h[1-6])\b/i;

export const isHtml = (s: string) => HTML_TAG.test(s);

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Plain text (older posts, AI output) -> editor HTML.
export function textToHtml(text: string): string {
  if (!text) return "";
  if (isHtml(text)) return text;
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

const cp = (base: number, offset: number) => String.fromCodePoint(base + offset);

function styleChar(ch: string, style: "bold" | "italic" | null): string {
  if (!style) return ch;
  if (style === "bold") {
    if (ch >= "A" && ch <= "Z") return cp(0x1d5d4, ch.charCodeAt(0) - 65);
    if (ch >= "a" && ch <= "z") return cp(0x1d5ee, ch.charCodeAt(0) - 97);
    if (ch >= "0" && ch <= "9") return cp(0x1d7ec, ch.charCodeAt(0) - 48);
  } else {
    if (ch >= "A" && ch <= "Z") return cp(0x1d608, ch.charCodeAt(0) - 65);
    if (ch >= "a" && ch <= "z") return cp(0x1d622, ch.charCodeAt(0) - 97);
  }
  return ch;
}

export function htmlToPlain(html: string, { styled = true }: { styled?: boolean } = {}): string {
  if (!html) return "";
  if (!isHtml(html)) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  let out = "";

  const ensureBreak = (n: number) => {
    if (!out) return;
    const trailing = out.length - out.trimEnd().length;
    const newlines = out.slice(out.length - trailing).split("\n").length - 1;
    if (newlines < n) out += "\n".repeat(n - newlines);
  };

  function walk(node: Node, style: "bold" | "italic" | null, list: { ordered: boolean; n: number }[]) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? "").replace(/\n/g, " ");
      out += styled && style ? Array.from(text).map((c) => styleChar(c, style)).join("") : text;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();

    let nextStyle = style;
    if (tag === "strong" || tag === "b") nextStyle = "bold";
    else if ((tag === "em" || tag === "i") && !style) nextStyle = "italic";

    if (tag === "br") return void (out += "\n");
    const block = tag === "p" || tag === "div" || /^h[1-6]$/.test(tag);
    if (block) ensureBreak(2);

    let nextList = list;
    if (tag === "ul" || tag === "ol") {
      ensureBreak(list.length ? 1 : 2);
      nextList = [...list, { ordered: tag === "ol", n: 0 }];
    } else if (tag === "li") {
      ensureBreak(1);
      const cur = list[list.length - 1];
      if (cur) {
        cur.n += 1;
        out += cur.ordered ? `${cur.n}. ` : "• ";
      }
    }

    const before = out.length;
    el.childNodes.forEach((child) => walk(child, nextStyle, nextList));

    if (tag === "a") {
      const href = el.getAttribute("href")?.trim();
      const text = out.slice(before).trim();
      if (href && href !== text) out += ` (${href})`;
    }
    if (block) ensureBreak(2);
    else if (tag === "ul" || tag === "ol") ensureBreak(list.length ? 1 : 2);
  }

  doc.body.childNodes.forEach((n) => walk(n, null, []));
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
