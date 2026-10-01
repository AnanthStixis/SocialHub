import type { ReactElement } from "react";
import PageHeader from "@/components/PageHeader";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Sparkles, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { AppNotification } from "@/lib/types";
import { useState } from "react";
import { Badge, Button, Card, LoadingSpinner, Modal } from "@/components/ui";

const TYPE_STYLE: Record<string, { icon: ReactElement; tile: string }> = {
  CONTENT_GENERATED: { icon: <Sparkles size={20} />, tile: "bg-ai-light text-ai ring-ai/15" },
  SCHEDULED: { icon: <Calendar size={20} />, tile: "bg-blue-light text-blue ring-blue/15" },
  PUBLISHED: { icon: <CheckCircle2 size={20} />, tile: "bg-success-light text-success ring-success/15" },
  PUBLISH_FAILED: { icon: <XCircle size={20} />, tile: "bg-danger-light text-danger ring-danger/15" },
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
  const [confirmClear, setConfirmClear] = useState(false);

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

  const clearMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/notifications/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const clearAllMutation = useMutation({
    mutationFn: async () => api.delete("/notifications"),
    onSuccess: () => {
      setConfirmClear(false);
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
      <PageHeader
        title={
          <>
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary ring-1 ring-inset ring-primary-100"><Bell size={20} /></span>
            Notifications
            {unreadCount > 0 && <Badge variant="primary">{unreadCount}</Badge>}
          </>
        }
        actions={
          notifications && notifications.length > 0 ? (
            <>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={() => markAllReadMutation.mutate()} loading={markAllReadMutation.isPending}>
                  Mark all as read
                </Button>
              )}
              <Button size="sm" className="border border-red-100 bg-danger-light text-danger shadow-none hover:bg-red-100 active:bg-red-200 focus-visible:ring-red-500" onClick={() => setConfirmClear(true)}>
                Clear all
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="space-y-2">
        {isLoading && <LoadingSpinner className="text-primary-500" />}
        {!isLoading && notifications?.length === 0 && (
          <div className="flex flex-col items-center rounded-xl border border-dashed border-gray-200 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary ring-8 ring-primary-50/50">
              <Bell size={26} />
            </div>
            <p className="text-sm font-medium text-gray-700">You're all caught up</p>
            <p className="mt-1 text-sm text-gray-400">Updates about your posts will appear here.</p>
          </div>
        )}
        {notifications?.map((n) => {
          const style = TYPE_STYLE[n.type] ?? { icon: <Bell size={20} />, tile: "bg-gray-100 text-gray-500 ring-gray-200" };
          return (
            <Card
              key={n.id}
              className={`relative flex items-start gap-4 p-4 transition-shadow hover:shadow-md ${n.is_read ? "" : "border-primary-200 bg-primary-50/40"}`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${style.tile}`}>{style.icon}</div>
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
                  <button
                    type="button"
                    onClick={() => clearMutation.mutate(n.id)}
                    className="ml-auto cursor-pointer text-xs font-medium text-gray-400 hover:text-danger"
                  >
                    Clear
                  </button>
                </div>
              </div>
              {!n.is_read && <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" aria-label="Unread" />}
            </Card>
          );
        })}
      </div>
      <Modal isOpen={confirmClear} onClose={() => setConfirmClear(false)} title="Clear all notifications?" size="sm">
        <p className="text-sm text-gray-500">This permanently removes every notification. This can't be undone.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmClear(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => clearAllMutation.mutate()} loading={clearAllMutation.isPending}>
            Clear all
          </Button>
        </div>
      </Modal>
    </div>
  );
}
