import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowRight, Calendar, CheckCircle2, Clock, Globe, Heart, MessageCircle, PenSquare } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { CalendarEntry, Platform, SocialAccount } from "@/lib/types";
import { PLATFORM_META } from "@/lib/platforms";
import PlatformIcon from "@/components/PlatformIcon";
import KpiCard from "@/components/KpiCard";
import { Button, Card } from "@/components/ui";

interface DashboardStats {
  total_posts: number;
  drafts: number;
  scheduled: number;
  published: number;
  failed: number;
  published_today: number;
  failed_today: number;
  connected_accounts: number;
  trends: { days: string[]; scheduled: number[]; published: number[]; failed: number[]; connected: number[] };
  breakdown: { scheduled: Record<string, number>; published: Record<string, number>; failed: Record<string, number>; connected: Record<string, number> };
}

interface EngagementItem {
  platform: Platform;
  likes: number;
  comments: number;
}

const PLATFORMS = Object.keys(PLATFORM_META) as Platform[];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function SectionTitle({ title, action }: { title: string; action?: { to: string; label: string } }) {
  return (
    <div className="mb-5 flex items-center justify-between border-b border-gray-100 pb-4">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      {action && (
        <Link to={action.to} className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-600">
          {action.label} <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const firstName = user?.full_name?.split(" ")[0] ?? "";

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<DashboardStats>("/dashboard")).data,
  });

  const { data: upcoming } = useQuery({
    queryKey: ["dashboard-upcoming"],
    queryFn: async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await api.get<CalendarEntry[]>("/calendar", { params: { start, end } });
      return data.filter((e) => e.status === "SCHEDULED").slice(0, 5);
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ["social-accounts"],
    queryFn: async () => (await api.get<SocialAccount[]>("/social-accounts")).data,
  });

  const { data: engagement } = useQuery({
    queryKey: ["dashboard-engagement"],
    queryFn: async () => {
      const date_from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      return (await api.get<{ items: EngagementItem[] }>("/reports/engagement", { params: { date_from } })).data.items;
    },
  });

  const cards = [
    { key: "scheduled", label: "Scheduled posts", hint: "In the publishing queue", value: data?.scheduled, icon: Clock, tone: "blue" as const },
    { key: "published", label: "Published today", hint: "Across all platforms", value: data?.published_today, icon: CheckCircle2, tone: "emerald" as const },
    { key: "failed", label: "Failed today", hint: "Needs attention", value: data?.failed_today, icon: AlertTriangle, tone: "red" as const, badWhenUp: true },
    { key: "connected", label: "Connected accounts", hint: "Pages and profiles", value: data?.connected_accounts, icon: Globe, tone: "slate" as const },
  ] as const;

  const items = engagement ?? [];
  const likes = items.reduce((a, i) => a + i.likes, 0);
  const comments = items.reduce((a, i) => a + i.comments, 0);
  const perPlatform = PLATFORMS.map((p) => {
    const rows = items.filter((i) => i.platform === p);
    return { platform: p, posts: rows.length, total: rows.reduce((a, i) => a + i.likes + i.comments, 0) };
  });
  const maxTotal = Math.max(1, ...perPlatform.map((p) => p.total));

  const grouped = Object.entries(
    (accounts ?? []).reduce<Record<string, SocialAccount[]>>((g, a) => {
      (g[a.platform] ??= []).push(a);
      return g;
    }, {}),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <>
            {greeting()}, {firstName}
          </>
        }
        description={`${data?.scheduled ?? 0} posts in queue · ${data?.published_today ?? 0} published today · ${data?.failed_today ?? 0} failures today`}
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/calendar")}>
              <Calendar size={16} /> Calendar
            </Button>
            <Button variant="primary" onClick={() => navigate("/compose")}>
              <PenSquare size={16} /> Create post
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {cards.map((c) => (
          <KpiCard
            key={c.key}
            label={c.label}
            hint={c.hint}
            value={isLoading ? 0 : c.value ?? 0}
            icon={c.icon}
            tone={c.tone}
            badWhenUp={"badWhenUp" in c ? c.badWhenUp : false}
            series={data?.trends?.[c.key] ?? new Array(14).fill(0)}
            breakdown={data?.breakdown?.[c.key] ?? {}}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <SectionTitle title="Upcoming posts" action={{ to: "/calendar", label: "Open calendar" }} />
          {upcoming && upcoming.length > 0 ? (
            <ul className="divide-y divide-gray-100">
              {upcoming.map((entry) => (
                <li key={entry.post_id}>
                  <Link to={`/compose/${entry.post_id}`} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 transition-colors hover:bg-gray-50">
                    <div className="flex w-16 shrink-0 flex-col items-center rounded-xl bg-primary-50 py-1.5 text-primary-700">
                      <span className="text-[11px] font-medium uppercase">{entry.scheduled_at ? new Date(entry.scheduled_at).toLocaleDateString([], { month: "short" }) : ""}</span>
                      <span className="text-lg font-semibold leading-none">{entry.scheduled_at ? new Date(entry.scheduled_at).getDate() : ""}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{entry.idea}</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {entry.scheduled_at && new Date(entry.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <div className="flex shrink-0 -space-x-1.5">
                      {entry.platforms.map((p) => (
                        <span key={p} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-50">
                          <PlatformIcon platform={p as Platform} size={13} />
                        </span>
                      ))}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary ring-8 ring-primary-50/50">
                <Calendar size={24} />
              </span>
              <p className="text-base font-semibold text-gray-900">Nothing scheduled yet</p>
              <p className="mt-1 max-w-xs text-sm text-gray-500">Plan your next post and it will show up here, ready for Facebook, Instagram and LinkedIn.</p>
              <div className="mt-3 flex -space-x-1.5">
                {PLATFORMS.map((p) => (
                  <span key={p} className="rounded-full border-2 border-white"><PlatformIcon platform={p} size={13} /></span>
                ))}
              </div>
              <Button size="sm" className="mt-5" onClick={() => navigate("/compose")}>
                Create post
              </Button>
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Connected accounts" action={{ to: "/settings/social-accounts", label: "Manage" }} />
          {grouped.length > 0 ? (
            <ul className="space-y-3">
              {grouped.map(([platform, group]) => {
                const ok = group.every((a) => a.status === "CONNECTED");
                const err = group.some((a) => a.status === "ERROR");
                return (
                  <li key={platform} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 transition-all duration-150 hover:-translate-y-px hover:border-gray-300">
                    <PlatformIcon platform={platform as Platform} size={24} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">{platform.charAt(0) + platform.slice(1).toLowerCase()}</p>
                      <p className="truncate text-xs text-gray-500">{group.map((a) => a.account_name).join(", ")}</p>
                    </div>
                    <span className={`flex items-center gap-1.5 text-xs font-medium ${ok ? "text-success" : err ? "text-danger" : "text-gray-500"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-success" : err ? "bg-danger" : "bg-gray-400"}`} />
                      {ok ? "Connected" : err ? "Error" : "Mixed"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-500">No accounts connected yet.</p>
              <Link to="/settings/social-accounts" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
                Connect an account
              </Link>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Engagement · last 7 days" action={{ to: "/analytics", label: "Full analytics" }} />
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="flex gap-8 md:flex-col md:gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-danger-light text-danger">
                <Heart size={16} />
              </span>
              <div>
                <p className="text-xl font-semibold tabular-nums text-gray-900">{likes.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Likes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-light text-blue">
                <MessageCircle size={16} />
              </span>
              <div>
                <p className="text-xl font-semibold tabular-nums text-gray-900">{comments.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Comments</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {perPlatform.map((p) => (
              <div key={p.platform} className="flex items-center gap-3">
                <span className="flex w-28 shrink-0 items-center gap-2 text-sm text-gray-700">
                  <PlatformIcon platform={p.platform} size={14} />
                  {PLATFORM_META[p.platform].name}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(p.total / maxTotal) * 100}%`, backgroundColor: PLATFORM_META[p.platform].color }} />
                </div>
                <span className="w-24 shrink-0 text-right text-xs text-gray-500">
                  {p.total.toLocaleString()} · {p.posts} {p.posts === 1 ? "post" : "posts"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
