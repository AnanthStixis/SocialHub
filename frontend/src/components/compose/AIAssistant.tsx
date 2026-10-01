import { useState } from "react";
import clsx from "clsx";
import { Check, Copy, Lightbulb, Link2, RotateCcw, Sparkles, Wand2, X, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Platform } from "@/lib/types";
import { PLATFORM_META, apiErrorMessage } from "@/lib/platforms";
import PlatformIcon from "@/components/PlatformIcon";
import PlatformSelector from "./PlatformSelector";
import { Button, Input, LoadingSpinner, Select } from "@/components/ui";

interface GeneratedPost {
  platform: Platform;
  content: string;
  hashtags: string[];
}

type AITab = "improve" | "topic" | "url";

const AI_TABS: { id: AITab; label: string; icon: LucideIcon }[] = [
  { id: "topic", label: "From Topic", icon: Lightbulb },
  { id: "improve", label: "Improve", icon: Wand2 },
  { id: "url", label: "From URL", icon: Link2 },
];

const TONES = ["professional", "casual", "humorous", "informative"];

const withHashtags = (p: { content: string; hashtags?: string[] }) =>
  p.hashtags?.length ? `${p.content}\n\n${p.hashtags.join(" ")}` : p.content;

export default function AIAssistant({
  content,
  activePlatform,
  selectedPlatforms,
  onUseContent,
}: {
  content: string;
  activePlatform?: Platform;
  selectedPlatforms: Platform[];
  onUseContent: (text: string, platform?: Platform) => void;
}) {
  const [tab, setTab] = useState<AITab>("topic");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [tone, setTone] = useState("professional");
  const [improved, setImproved] = useState("");
  // Inline "Improve" results shown under the card they came from, keyed by card id.
  const [inline, setInline] = useState<Record<string, { loading?: boolean; error?: string }>>({});
  // Improved text replaces the generated text in the same card; the original is kept for Undo.
  const [edited, setEdited] = useState<Record<string, string>>({});
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const dismiss = (id: string) => setDismissed((d) => new Set(d).add(id));
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [topic, setTopic] = useState("");
  const [topicPlatforms, setTopicPlatforms] = useState<Platform[]>([]);
  const [count, setCount] = useState(1);
  const [topicPosts, setTopicPosts] = useState<GeneratedPost[]>([]);

  const [url, setUrl] = useState("");
  const [urlPlatforms, setUrlPlatforms] = useState<Platform[]>([]);
  const [urlPosts, setUrlPosts] = useState<GeneratedPost[]>([]);
  const [urlMeta, setUrlMeta] = useState<{ title: string; summary: string } | null>(null);

  async function run(action: () => Promise<void>, fallback: string) {
    setLoading(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, fallback));
    } finally {
      setLoading(false);
    }
  }

  // Own platform pick wins; otherwise fall back to the composer's selection.
  const targetsFor = (own: Platform[]) => (own.length > 0 ? own : selectedPlatforms);

  const improve = () =>
    run(async () => {
      setImproved("");
      setSuggestions([]);
      const { data } = await api.post<{ improved: string; suggestions: string[] }>("/ai/improve", {
        content,
        platform: activePlatform ?? selectedPlatforms[0] ?? "FACEBOOK",
        tone,
      });
      setImproved(data.improved);
      setSuggestions(data.suggestions);
    }, "Failed to improve post");

  const generateFromTopic = () =>
    run(async () => {
      const platforms = targetsFor(topicPlatforms);
      if (platforms.length === 0) throw new Error("no platform");
      setTopicPosts([]);
      setEdited({});
      setDismissed(new Set());
      const { data } = await api.post<{ posts: GeneratedPost[] }>("/ai/generate", { topic, platforms, count });
      setTopicPosts(data.posts);
    }, "Failed to generate posts");

  const generateFromUrl = () =>
    run(async () => {
      const platforms = targetsFor(urlPlatforms);
      if (platforms.length === 0) throw new Error("no platform");
      setUrlPosts([]);
      setEdited({});
      setDismissed(new Set());
      setUrlMeta(null);
      const { data } = await api.post<{ title: string; summary: string; posts: GeneratedPost[] }>("/ai/url-to-post", { url, platforms });
      setUrlPosts(data.posts);
      setUrlMeta({ title: data.title, summary: data.summary });
    }, "Failed to generate posts from URL");

  async function improveInline(id: string, text: string, platform?: Platform) {
    setInline((m) => ({ ...m, [id]: { loading: true } }));
    try {
      const { data } = await api.post<{ improved: string }>("/ai/improve", {
        content: text,
        platform: platform ?? activePlatform ?? selectedPlatforms[0] ?? "FACEBOOK",
        tone,
      });
      setEdited((m) => ({ ...m, [id]: data.improved }));
      setInline((m) => ({ ...m, [id]: {} }));
    } catch (err) {
      setInline((m) => ({ ...m, [id]: { error: apiErrorMessage(err, "Failed to improve post") } }));
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError("Could not copy to the clipboard");
    }
  }

  function PostCard({ post, id, closable = true }: { post: { platform?: Platform; content: string; hashtags?: string[] }; id: string; closable?: boolean }) {
    if (dismissed.has(id)) return null;
    const isEdited = id in edited;
    const text = edited[id] ?? withHashtags(post);
    return (
      <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {post.platform && (
              <>
                <PlatformIcon platform={post.platform} size={12} />
                <span className="text-xs font-medium text-gray-600">{PLATFORM_META[post.platform].name}</span>
              </>
            )}
            {isEdited && <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">Improved</span>}
          </div>
          <div className="flex items-center gap-0.5">
            {isEdited && (
              <button
                type="button"
                title="Undo improve"
                aria-label="Undo improve"
                onClick={() => setEdited(({ [id]: _, ...rest }) => rest)}
                className="cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <RotateCcw size={14} />
              </button>
            )}
            {closable && (
              <button
                type="button"
                title="Remove"
                aria-label="Remove"
                onClick={() => dismiss(id)}
                className="cursor-pointer rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{text}</p>
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" onClick={() => onUseContent(text, post.platform)}>
            {post.platform ? `Use for ${PLATFORM_META[post.platform].name}` : "Use This"}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => improveInline(id, text, post.platform)} disabled={loading || inline[id]?.loading}>
            <Wand2 size={14} /> {inline[id]?.loading ? "Improving..." : "Improve"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => copy(text, id)}>
            {copiedKey === id ? <Check size={14} /> : <Copy size={14} />}
            {copiedKey === id ? "Copied" : "Copy"}
          </Button>
        </div>
        {inline[id]?.error && <p className="text-xs text-red-600">{inline[id].error}</p>}
      </div>
    );
  }

  function PlatformPick({ own, setOwn }: { own: Platform[]; setOwn: (p: Platform[]) => void }) {
    return (
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-600">Platforms</label>
        <PlatformSelector compact selected={own} onChange={setOwn} />
        {own.length === 0 && (
          <p className="mt-1 text-[11px] text-gray-400">
            {selectedPlatforms.length > 0
              ? `Will use your selected platforms: ${selectedPlatforms.map((p) => PLATFORM_META[p].name).join(", ")}`
              : "Pick at least one platform"}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex" role="tablist">
          {AI_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => {
                setTab(id);
                setError("");
              }}
              className={clsx(
                "flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-xs font-medium transition-colors",
                tab === id ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {tab === "improve" &&
        (!content.trim() ? (
          <div className="py-6 text-center">
            <Sparkles size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">Write some content first, then improve it with AI</p>
          </div>
        ) : (
          <div className="space-y-3">
            <Select label="Tone" value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </Select>
            <Button className="w-full" onClick={improve} loading={loading}>
              <Wand2 size={16} /> Improve with AI
            </Button>
            {improved && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Improved version:</p>
                <PostCard post={{ content: improved, platform: activePlatform }} id="improve" closable={false} />
                {suggestions.length > 0 && (
                  <ul className="space-y-1">
                    {suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
                        <span className="mt-0.5 shrink-0 text-primary-400">-</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}

      {tab === "topic" && (
        <div className="space-y-3">
          <Input label="Topic or idea" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g., Launch of our new AI feature" />
          <PlatformPick own={topicPlatforms} setOwn={setTopicPlatforms} />
          <div>
            <label className="mb-1.5 block text-xs font-medium text-gray-600">Variations per platform</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCount(n)}
                  className={clsx(
                    "h-8 w-8 cursor-pointer rounded-md border text-sm font-medium transition-all",
                    count === n ? "border-primary-500 bg-primary-500 text-white" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400",
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full" onClick={generateFromTopic} loading={loading} disabled={!topic.trim() || targetsFor(topicPlatforms).length === 0}>
            <Sparkles size={16} /> Generate
          </Button>
          {topicPosts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">Generated posts:</p>
                <button type="button" className="cursor-pointer text-xs text-gray-500 hover:text-gray-700" onClick={() => { setTopicPosts([]); setEdited({}); setDismissed(new Set()); }}>
                  Clear all
                </button>
              </div>
              {topicPosts.map((p, i) => (
                <PostCard key={i} post={p} id={`topic-${i}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "url" && (
        <div className="space-y-3">
          <Input label="URL" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/article" />
          <PlatformPick own={urlPlatforms} setOwn={setUrlPlatforms} />
          <Button className="w-full" onClick={generateFromUrl} loading={loading} disabled={!url.trim() || targetsFor(urlPlatforms).length === 0}>
            <Link2 size={16} /> Generate from URL
          </Button>
          {urlMeta && (urlMeta.title || urlMeta.summary) && (
            <div className="space-y-1 rounded-lg bg-gray-50 p-3">
              {urlMeta.title && <p className="text-sm font-medium text-gray-900">{urlMeta.title}</p>}
              {urlMeta.summary && <p className="text-xs leading-relaxed text-gray-600">{urlMeta.summary}</p>}
            </div>
          )}
          {urlPosts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">Generated posts:</p>
                <button type="button" className="cursor-pointer text-xs text-gray-500 hover:text-gray-700" onClick={() => { setUrlPosts([]); setEdited({}); setDismissed(new Set()); }}>
                  Clear all
                </button>
              </div>
              {urlPosts.map((p, i) => (
                <PostCard key={i} post={p} id={`url-${i}`} />
              ))}
            </div>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-2 text-primary-600">
          <LoadingSpinner size="sm" />
          <span className="text-sm">Generating...</span>
        </div>
      )}
    </div>
  );
}
