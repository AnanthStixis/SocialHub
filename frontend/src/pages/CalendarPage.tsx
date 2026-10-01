import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { View } from "react-big-calendar";
import { addDays, endOfMonth, isSameDay, startOfMonth } from "date-fns";
import { CalendarDays } from "lucide-react";
import toast from "@/lib/toast";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/platforms";
import { CalendarEntry } from "@/lib/types";
import { Button, LoadingSpinner, Modal } from "@/components/ui";
import ContentCalendar, { entryDate } from "@/components/calendar/ContentCalendar";
import PostQueue from "@/components/calendar/PostQueue";
import DayDetail from "@/components/calendar/DayDetail";

const fetchCalendar = async (start: Date, end: Date) =>
  (await api.get<CalendarEntry[]>("/calendar", { params: { start: start.toISOString(), end: end.toISOString() } })).data;

export default function CalendarPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("month");
  const [date, setDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEntry | null>(null);

  // Padded so the leading/trailing days shown in the month grid are covered.
  const rangeStart = addDays(startOfMonth(date), -7);
  const rangeEnd = addDays(endOfMonth(date), 7);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["calendar", rangeStart.toDateString(), rangeEnd.toDateString()],
    queryFn: () => fetchCalendar(rangeStart, rangeEnd),
  });

  const { data: upcoming = [] } = useQuery({
    queryKey: ["calendar", "upcoming"],
    queryFn: async () =>
      (await fetchCalendar(new Date(), addDays(new Date(), 90))).filter((e) => e.status === "SCHEDULED" && e.scheduled_at),
  });

  const dayEntries = useMemo(
    () => (selectedDay ? entries.filter((e) => isSameDay(entryDate(e), selectedDay)) : []),
    [entries, selectedDay],
  );

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => api.delete(`/posts/${postId}`),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["calendar"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("The post has been deleted.");
    },
    onError: (err) => {
      setDeleteTarget(null);
      toast.error(apiErrorMessage(err, "We couldn't delete the post. Please try again."));
    },
  });

  const openEntry = (e: CalendarEntry) => setSelectedDay(entryDate(e));

  return (
    <div className="-mx-6 -my-8 flex min-h-[calc(100%+4rem)] flex-col bg-[#f4f6f8]">
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <CalendarDays size={24} className="text-primary-500" />
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Content Calendar</h1>
            <p className="text-sm text-gray-500">Plan and schedule your social media content</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative flex-1 overflow-auto p-6">
          {isLoading && (
            <div className="absolute right-8 top-8 z-10 text-primary-500">
              <LoadingSpinner size="sm" />
            </div>
          )}
          <ContentCalendar
            entries={entries}
            view={view}
            onView={setView}
            date={date}
            onNavigate={setDate}
            onSelectEntry={openEntry}
            onSelectSlot={setSelectedDay}
          />
        </div>

        <aside className="flex w-full shrink-0 flex-col overflow-hidden border-t border-gray-100 bg-white lg:w-80 lg:border-l lg:border-t-0">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">Upcoming Queue</h2>
            <p className="mt-0.5 text-xs text-gray-500">Scheduled posts</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <PostQueue entries={upcoming} onSelect={openEntry} />
          </div>
        </aside>
      </div>

      <DayDetail
        date={selectedDay}
        entries={dayEntries}
        isOpen={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        onEdit={(e) => navigate(`/compose/${e.post_id}`)}
        onDelete={setDeleteTarget}
      />

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete post?" size="sm">
        <p className="text-sm text-gray-500">"{deleteTarget?.idea}" will be permanently removed. This can't be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>
            Cancel
          </Button>
          <Button variant="danger" loading={deleteMutation.isPending} onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.post_id)}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
