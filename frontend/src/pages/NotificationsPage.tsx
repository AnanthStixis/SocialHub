import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Sparkles, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { AppNotification } from "@/lib/types";
import { Badge, Button, Card, LoadingSpinner } from "@/components/ui";

const TYPE_STYLE: Record<string, { icon: ReactElement; tile: string }> = {
  CONTENT_GENERATED: { icon: <Sparkles size={18} />, tile: "bg-primary-50 text-primary-600" },
  SCHEDULED: { icon: <Calendar size={18} />, tile: "bg-blue-50 text-blue-600" },
  PUBLISHED: { icon: <CheckCircle2 size={18} />, tile: "bg-emerald-50 text-emerald-600" },
  PUBLISH_FAILED: { icon: <XCircle size={18} />, tile: "bg-red-50 text-red-600" },
};

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => (await api.get<AppNotification[]>("/notifications")).data,
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => api.post("/notifications/read-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const unreadCount = notifications?.filter((n) => !n.is_read).length ?? 0;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Notifications
          {unreadCount > 0 && (
            <Badge variant="primary">{unreadCount}</Badge>
          )}
        </h1>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
            Mark all as read
          </Button>
        )}
      </div>

      <div className="space-y-2">
        {isLoading && <LoadingSpinner className="text-primary-500" />}
        {!isLoading && notifications?.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Bell size={22} />
            </div>
            <p className="text-sm font-medium text-gray-700">You're all caught up</p>
            <p className="mt-1 text-sm text-gray-400">Updates about your posts will appear here.</p>
          </div>
        )}
        {notifications?.map((n) => {
          const style = TYPE_STYLE[n.type] ?? { icon: <Bell size={18} />, tile: "bg-gray-100 text-gray-500" };
          return (
            <Card
              key={n.id}
              className={`relative flex items-start gap-4 p-4 transition-shadow hover:shadow-md ${n.is_read ? "" : "border-primary-200 bg-primary-50/30"}`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.tile}`}>{style.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className={`text-sm text-gray-900 ${n.is_read ? "font-medium" : "font-semibold"}`}>{n.title}</p>
                  <span className="shrink-0 text-xs text-gray-400" title={new Date(n.created_at).toLocaleString()}>
                    {timeAgo(n.created_at)}
                  </span>
                </div>
                {n.body && <p className="mt-0.5 text-sm leading-relaxed text-gray-500">{n.body}</p>}
                <div className="mt-2 flex items-center gap-4">
                  {n.entity_type === "Post" && n.entity_id && (
                    <Link to={`/compose/${n.entity_id}`} className="text-xs font-semibold text-primary-600 hover:underline">
                      View post →
                    </Link>
                  )}
                  {!n.is_read && (
                    <button
                      type="button"
                      onClick={() => markReadMutation.mutate(n.id)}
                      className="cursor-pointer text-xs font-medium text-gray-500 hover:text-gray-800"
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
              {!n.is_read && <span className="absolute right-3 top-3 hidden h-2 w-2 rounded-full bg-primary-500" aria-label="Unread" />}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
