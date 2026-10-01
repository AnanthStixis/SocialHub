import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Clock, CheckCircle2, AlertTriangle, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { CalendarEntry, Platform, SocialAccount } from "@/lib/types";
import PlatformIcon from "@/components/PlatformIcon";
import KpiCard from "@/components/KpiCard";
import { Card } from "@/components/ui";

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

export default function DashboardPage() {
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

  const cards = [
    { key: "scheduled", label: "Scheduled Posts", hint: "In the publishing queue", value: data?.scheduled, icon: Clock, tone: "blue" as const },
    { key: "published", label: "Published Today", hint: "Across all platforms", value: data?.published_today, icon: CheckCircle2, tone: "emerald" as const },
    { key: "failed", label: "Failed Today", hint: "Needs attention", value: data?.failed_today, icon: AlertTriangle, tone: "red" as const, badWhenUp: true },
    { key: "connected", label: "Connected Accounts", hint: "Pages and profiles", value: data?.connected_accounts, icon: Globe, tone: "slate" as const },
  ] as const;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Good morning, {firstName}.</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data?.scheduled ?? 0} posts in queue · {data?.published_today ?? 0} published today ·{" "}
            {data?.failed_today ?? 0} failures today.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Upcoming Posts</h2>
          {upcoming && upcoming.length > 0 ? (
            <ul className="space-y-2">
              {upcoming.map((entry) => (
                <li key={entry.post_id} className="flex items-center justify-between text-sm">
                  <Link to={`/compose/${entry.post_id}`} className="truncate text-gray-700 hover:text-primary-700">
                    {entry.idea}
                  </Link>
                  <span className="ml-3 shrink-0 text-gray-400">
                    {entry.scheduled_at &&
                      new Date(entry.scheduled_at).toLocaleString([], {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                    · {entry.platforms.join(" + ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-400">No scheduled posts yet.</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 font-semibold">Platform Connection Status</h2>
          {accounts && accounts.length > 0 ? (
            <ul className="space-y-2">
              {Object.entries(
                accounts.reduce<Record<string, SocialAccount[]>>((groups, a) => {
                  (groups[a.platform] ??= []).push(a);
                  return groups;
                }, {})
              ).map(([platform, group]) => {
                const allConnected = group.every((a) => a.status === "CONNECTED");
                const anyError = group.some((a) => a.status === "ERROR");
                return (
                  <li key={platform} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex min-w-0 items-center gap-2 truncate">
                      <PlatformIcon platform={platform as Platform} />
                      {platform.charAt(0) + platform.slice(1).toLowerCase()}
                      {" - "}
                      <span className="truncate text-gray-500">{group.map((a) => a.account_name).join(", ")}</span>
                    </span>
                    <span
                      className={`shrink-0 ${allConnected ? "text-emerald-600" : anyError ? "text-red-600" : "text-gray-400"}`}
                    >
                      {allConnected ? "CONNECTED" : anyError ? "ERROR" : "MIXED"}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <Link to="/settings/social-accounts" className="text-sm text-primary-600 hover:underline">
              Connect an account
            </Link>
          )}
        </Card>
      </div>
    </div>
  );
}
