import { useMemo, useState, type CSSProperties } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { ArrowDown, FileText, Heart, MessageCircle, RefreshCw, Sparkles, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { DownloadMenu, RangePicker, useFilters } from "@/components/FilterPanel";
import PlatformIcon from "@/components/PlatformIcon";
import KpiCard from "@/components/KpiCard";
import { Button, Card, LoadingSpinner } from "@/components/ui";
import { PLATFORM_META } from "@/lib/platforms";
import type { Platform } from "@/lib/types";

interface Summary {
  total_posts: number;
  by_status: Record<string, number>;
  jobs: Record<string, number>;
  success_rate: number | null;
}

interface EngagementItem {
  post_id: string;
  idea: string;
  platform: Platform;
  published_at: string | null;
  likes: number;
  comments: number;
}
interface Engagement {
  items: EngagementItem[];
  last_synced: string | null;
}

const PLATFORMS = Object.keys(PLATFORM_META) as Platform[];
type SortKey = "total" | "likes" | "comments" | "date";

const STATUS_ROWS: { key: string; label: string; bar: string }[] = [
  { key: "PUBLISHED", label: "Published", bar: "bg-emerald-500" },
  { key: "SCHEDULED", label: "Scheduled", bar: "bg-sky-500" },
  { key: "DRAFT", label: "Drafts", bar: "bg-gray-400" },
  { key: "PARTIALLY_PUBLISHED", label: "Partially published", bar: "bg-amber-500" },
  { key: "FAILED", label: "Failed", bar: "bg-red-500" },
];

const fmt = (n: number) => n.toLocaleString();
const avg = (n: number, d: number) => (d ? Math.round((n / d) * 10) / 10 : 0);

interface Totals {
  posts: number;
  likes: number;
  comments: number;
}
const sum = (items: EngagementItem[]): Totals => ({
  posts: items.length,
  likes: items.reduce((a, i) => a + i.likes, 0),
  comments: items.reduce((a, i) => a + i.comments, 0),
});

export default function AnalyticsPage() {
  const filters = useFilters(undefined, "status_filter", "30");
  const { date_from, date_to } = filters.params;
  const dateParams: Record<string, string> = { ...(date_from ? { date_from } : {}), ...(date_to ? { date_to } : {}) };

  const [platform, setPlatform] = useState<Platform | "ALL">("ALL");
  const [sort, setSort] = useState<SortKey>("total");

  const qc = useQueryClient();
  const summary = useQuery({
    queryKey: ["analytics-summary", date_from, date_to],
    queryFn: async () => (await api.get<Summary>("/reports/summary", { params: dateParams })).data,
  });
  const engagement = useQuery({
    queryKey: ["analytics-engagement", date_from, date_to],
    queryFn: async () => (await api.get<Engagement>("/reports/engagement", { params: dateParams })).data,
  });
  const sync = useMutation({
    mutationFn: async () => (await api.post("/reports/engagement/sync", null, { params: dateParams })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["analytics-engagement"] }),
  });

  const allItems = useMemo(() => engagement.data?.items ?? [], [engagement.data]);
  const items = useMemo(() => (platform === "ALL" ? allItems : allItems.filter((i) => i.platform === platform)), [allItems, platform]);
  const totals = sum(items);
  const engagementTotal = totals.likes + totals.comments;

  const perPlatform = PLATFORMS.map((p) => ({ platform: p, ...sum(allItems.filter((i) => i.platform === p)) }));
  const maxPlatformEng = Math.max(1, ...perPlatform.map((p) => p.likes + p.comments));

  // Daily likes/comments by publish date, last 30 active days.
  const daily = useMemo(() => {
    const m = new Map<string, { likes: number; comments: number; posts: number }>();
    for (const i of items) {
      if (!i.published_at) continue;
      const d = i.published_at.slice(0, 10);
      const e = m.get(d) ?? { likes: 0, comments: 0, posts: 0 };
      e.likes += i.likes;
      e.comments += i.comments;
      e.posts += 1;
      m.set(d, e);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-30);
  }, [items]);
  const maxDaily = Math.max(1, ...daily.map(([, v]) => v.likes + v.comments));

  // One row per post (its platforms combined), or per publication when a single platform is chosen.
  const rows = useMemo(() => {
    const byPost = new Map<string, { id: string; idea: string; date: string | null; platforms: Platform[]; likes: number; comments: number }>();
    for (const i of items) {
      const r = byPost.get(i.post_id) ?? { id: i.post_id, idea: i.idea, date: i.published_at, platforms: [], likes: 0, comments: 0 };
      r.platforms.push(i.platform);
      r.likes += i.likes;
      r.comments += i.comments;
      if (i.published_at && (!r.date || i.published_at > r.date)) r.date = i.published_at;
      byPost.set(i.post_id, r);
    }
    const key = (r: { likes: number; comments: number; date: string | null }) =>
      sort === "likes" ? r.likes : sort === "comments" ? r.comments : sort === "date" ? Date.parse(r.date ?? "") || 0 : r.likes + r.comments;
    return [...byPost.values()].sort((a, b) => key(b) - key(a));
  }, [items, sort]);

  // Last 14 days (incl. zeros) for the KPI sparklines, and per-platform values for the hover breakdown.
  const trend = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (13 - i));
      return d.toISOString().slice(0, 10);
    });
    const at = (day: string) => items.filter((i) => i.published_at?.slice(0, 10) === day);
    const f = (g: (t: Totals) => number) => days.map((d) => g(sum(at(d))));
    return {
      posts: f((t) => t.posts),
      likes: f((t) => t.likes),
      comments: f((t) => t.comments),
      engagement: f((t) => t.likes + t.comments),
      average: f((t) => avg(t.likes + t.comments, t.posts)),
    };
  }, [items]);
  const byPlatform = (g: (t: Totals) => number) => Object.fromEntries(PLATFORMS.map((p) => [p, g(sum(items.filter((i) => i.platform === p)))]));

  const best = useMemo(() => [...rows].sort((a, b) => b.likes + b.comments - (a.likes + a.comments))[0], [rows]);
  const loading = engagement.isLoading || summary.isLoading;
  const platformLabel = platform === "ALL" ? "all platforms" : PLATFORM_META[platform].name;

  const sortHead = (k: SortKey, label: string, right = false) => (
    <th className={clsx("py-2 pr-4", right && "text-right")}>
      <button type="button" onClick={() => setSort(k)} className={clsx("inline-flex cursor-pointer items-center gap-1 uppercase", sort === k && "text-primary-600")}>
        {label}
        {sort === k && <ArrowDown size={12} />}
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">How your posts are performing on each social platform.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <RangePicker filters={filters} />
          <Button variant="secondary" onClick={() => sync.mutate()} loading={sync.isPending}>
            <RefreshCw size={14} /> Refresh from platforms
          </Button>
        </div>
      </div>
      {(sync.isError || engagement.data?.last_synced) && (
        <p className={clsx("-mt-4 mb-4 text-xs", sync.isError ? "text-red-600" : "text-gray-400")}>
          {sync.isError ? "Could not refresh engagement." : `Likes and comments last refreshed ${new Date(engagement.data!.last_synced!).toLocaleString()}`}
        </p>
      )}

      {loading ? (
        <LoadingSpinner size="lg" className="text-primary-500" />
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(["ALL", ...PLATFORMS] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className={clsx(
                  "flex cursor-pointer items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                  platform === p ? "border-primary-500 bg-primary-500 text-white" : "border-gray-300 bg-white text-gray-700 hover:border-gray-400",
                )}
              >
                {p !== "ALL" && <PlatformIcon platform={p} size={14} />}
                {p === "ALL" ? "All platforms" : PLATFORM_META[p].name}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <KpiCard compact label="Posts" hint={`Published on ${platformLabel}`} value={totals.posts} icon={FileText} tone="blue" series={trend.posts} breakdown={byPlatform((t) => t.posts)} />
            <KpiCard compact label="Likes" hint={`${avg(totals.likes, totals.posts)} per post`} value={totals.likes} icon={Heart} tone="red" series={trend.likes} breakdown={byPlatform((t) => t.likes)} />
            <KpiCard compact label="Comments" hint={`${avg(totals.comments, totals.posts)} per post`} value={totals.comments} icon={MessageCircle} tone="emerald" series={trend.comments} breakdown={byPlatform((t) => t.comments)} />
            <KpiCard compact label="Engagement" hint="Likes + comments" value={engagementTotal} icon={Sparkles} tone="slate" series={trend.engagement} breakdown={byPlatform((t) => t.likes + t.comments)} />
            <KpiCard compact label="Avg / post" hint="Engagement per post" value={avg(engagementTotal, totals.posts)} icon={TrendingUp} tone="blue" series={trend.average} breakdown={byPlatform((t) => avg(t.likes + t.comments, t.posts))} />
          </div>

          {totals.posts === 0 ? (
            <Card>
              <p className="py-10 text-center text-sm text-gray-400">
                No published posts on {platformLabel} in this period. Publish a post, then press “Refresh from platforms”.
              </p>
            </Card>
          ) : (
            <>
              {platform === "ALL" && (
                <Card>
                  <Card.Header>
                    <h2 className="text-sm font-semibold text-gray-900">Platform comparison</h2>
                  </Card.Header>
                  <div className="grid gap-4 md:grid-cols-3">
                    {perPlatform.map((p) => {
                      const eng = p.likes + p.comments;
                      return (
                        <button
                          key={p.platform}
                          type="button"
                          onClick={() => setPlatform(p.platform)}
                          style={{ "--c": PLATFORM_META[p.platform].color, "--soft": `${PLATFORM_META[p.platform].color}59`, "--tint": `${PLATFORM_META[p.platform].color}0A` } as CSSProperties}
                          className="cursor-pointer rounded-xl border border-gray-200 p-4 text-left transition-all duration-300 hover:border-[var(--soft)] hover:bg-[var(--tint)] hover:shadow-[0_4px_12px_-4px_var(--soft)]"
                        >
                          <div className="mb-3 flex items-center gap-2">
                            <PlatformIcon platform={p.platform} size={18} />
                            <span className="font-medium text-gray-900">{PLATFORM_META[p.platform].name}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center">
                            {[
                              ["Posts", p.posts],
                              ["Likes", p.likes],
                              ["Comments", p.comments],
                            ].map(([l, v]) => (
                              <div key={l}>
                                <p className="text-lg font-semibold text-gray-900">{fmt(v as number)}</p>
                                <p className="text-[11px] text-gray-500">{l}</p>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                            <div className="h-full rounded-full" style={{ width: `${(eng / maxPlatformEng) * 100}%`, backgroundColor: PLATFORM_META[p.platform].color }} />
                          </div>
                          <p className="mt-1.5 text-xs text-gray-500">
                            {fmt(eng)} engagement · {avg(eng, p.posts)} per post
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              <div className="grid gap-6 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <Card.Header>
                    <div className="flex items-center justify-between">
                      <h2 className="text-sm font-semibold text-gray-900">Engagement over time</h2>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-sm bg-red-400" /> Likes
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-2 w-2 rounded-sm bg-emerald-400" /> Comments
                        </span>
                      </div>
                    </div>
                  </Card.Header>
                  <div className="flex h-48 items-end gap-1.5 overflow-x-auto">
                    {daily.map(([d, v]) => (
                      <div key={d} className="flex min-w-[28px] flex-1 flex-col items-center justify-end gap-1" title={`${d}: ${v.posts} posts, ${v.likes} likes, ${v.comments} comments`}>
                        <span className="text-[10px] text-gray-500">{v.likes + v.comments}</span>
                        <div className="flex w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${((v.likes + v.comments) / maxDaily) * 130}px` }}>
                          <div className="bg-emerald-400" style={{ flex: v.comments }} />
                          <div className="bg-red-400" style={{ flex: v.likes }} />
                        </div>
                        <span className="text-[10px] text-gray-400">{d.slice(5)}</span>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card>
                  <Card.Header>
                    <h2 className="text-sm font-semibold text-gray-900">Top post</h2>
                  </Card.Header>
                  {best && (
                    <div className="space-y-3">
                      <p className="line-clamp-4 text-sm text-gray-800">{best.idea}</p>
                      <div className="flex gap-1.5">
                        {best.platforms.map((p) => (
                          <PlatformIcon key={p} platform={p} size={14} />
                        ))}
                      </div>
                      <div className="flex gap-6 text-sm">
                        <span className="flex items-center gap-1.5 text-gray-700">
                          <Heart size={14} className="text-red-500" /> {fmt(best.likes)}
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-700">
                          <MessageCircle size={14} className="text-emerald-500" /> {fmt(best.comments)}
                        </span>
                      </div>
                    </div>
                  )}
                </Card>
              </div>

              <Card>
                <Card.Header>
                  <h2 className="text-sm font-semibold text-gray-900">Post performance</h2>
                </Card.Header>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs text-gray-500">
                      <tr>
                        <th className="py-2 pr-4 uppercase">Post</th>
                        <th className="py-2 pr-4 uppercase">Platforms</th>
                        {sortHead("date", "Published")}
                        {sortHead("likes", "Likes", true)}
                        {sortHead("comments", "Comments", true)}
                        {sortHead("total", "Engagement", true)}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.map((r) => (
                        <tr key={r.id} className="transition-colors hover:bg-primary-50/60">
                          <td className="max-w-xs truncate py-2 pr-4 text-gray-900">{r.idea}</td>
                          <td className="py-2 pr-4">
                            <div className="flex gap-1.5">
                              {r.platforms.map((p) => (
                                <PlatformIcon key={p} platform={p} size={14} />
                              ))}
                            </div>
                          </td>
                          <td className="whitespace-nowrap py-2 pr-4 text-gray-500">{r.date ? new Date(r.date).toLocaleDateString() : "-"}</td>
                          <td className="py-2 pr-4 text-right">{fmt(r.likes)}</td>
                          <td className="py-2 pr-4 text-right">{fmt(r.comments)}</td>
                          <td className="py-2 pr-4 text-right font-semibold">{fmt(r.likes + r.comments)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}

          {summary.data && (
            <Card>
              <Card.Header>
                <h2 className="text-sm font-semibold text-gray-900">Publishing health</h2>
              </Card.Header>
              <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                {STATUS_ROWS.map((s) => {
                  const v = summary.data.by_status[s.key] ?? 0;
                  return (
                    <div key={s.key}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="text-gray-700">{s.label}</span>
                        <span className="font-medium text-gray-900">{v}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${summary.data.total_posts ? (v / summary.data.total_posts) * 100 : 0}%` }} />
                      </div>
                    </div>
                  );
                })}
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="text-gray-700">Success rate</span>
                    <span className="font-medium text-gray-900">{summary.data.success_rate ?? 0}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-primary-500" style={{ width: `${summary.data.success_rate ?? 0}%` }} />
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <Card.Header>
              <h2 className="text-sm font-semibold text-gray-900">Download reports</h2>
            </Card.Header>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Posts report", desc: "Every post with status, platforms and dates.", endpoint: "/reports/posts" },
                { title: "Publishing report", desc: "Each publishing job per platform and page, with results.", endpoint: "/reports/publishing" },
              ].map((r) => (
                <div key={r.title} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{r.title}</p>
                    <p className="text-xs text-gray-500">{r.desc}</p>
                  </div>
                  <DownloadMenu endpoint={r.endpoint} params={dateParams} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
