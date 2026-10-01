import { useMemo } from "react";
import { Calendar, dateFnsLocalizer, type SlotInfo, type View } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { CalendarEntry } from "@/lib/types";
import { PLATFORM_META } from "@/lib/platforms";

const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales: { "en-US": enUS } });

export const entryDate = (e: CalendarEntry) => new Date((e.scheduled_at ?? e.published_at)!);

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  entry: CalendarEntry;
}

const TOOLBAR_STYLES = [
  "[&_.rbc-toolbar]:mb-4 [&_.rbc-toolbar]:flex-wrap [&_.rbc-toolbar]:gap-2",
  "[&_.rbc-toolbar_button]:rounded-lg [&_.rbc-toolbar_button]:border-gray-300 [&_.rbc-toolbar_button]:px-3 [&_.rbc-toolbar_button]:py-1.5 [&_.rbc-toolbar_button]:text-sm [&_.rbc-toolbar_button]:font-medium [&_.rbc-toolbar_button]:text-gray-700",
  "[&_.rbc-toolbar_button:hover]:bg-gray-100",
  "[&_.rbc-toolbar_button.rbc-active]:border-primary-300 [&_.rbc-toolbar_button.rbc-active]:bg-primary-50 [&_.rbc-toolbar_button.rbc-active]:text-primary-700 [&_.rbc-toolbar_button.rbc-active]:shadow-none",
  "[&_.rbc-header]:py-2 [&_.rbc-header]:text-sm [&_.rbc-header]:font-medium [&_.rbc-header]:text-gray-600",
  "[&_.rbc-today]:bg-primary-50/50 [&_.rbc-off-range-bg]:bg-gray-50",
  "[&_.rbc-show-more]:text-xs [&_.rbc-show-more]:font-medium [&_.rbc-show-more]:text-primary-600",
].join(" ");

export default function ContentCalendar({
  entries,
  view,
  onView,
  date,
  onNavigate,
  onSelectEntry,
  onSelectSlot,
}: {
  entries: CalendarEntry[];
  view: View;
  onView: (v: View) => void;
  date: Date;
  onNavigate: (d: Date) => void;
  onSelectEntry: (e: CalendarEntry) => void;
  onSelectSlot: (d: Date) => void;
}) {
  const events = useMemo<CalEvent[]>(
    () =>
      entries
        .filter((e) => e.scheduled_at ?? e.published_at)
        .map((e) => ({ id: e.post_id, title: e.idea, start: entryDate(e), end: entryDate(e), entry: e })),
    [entries],
  );

  return (
    <div className={`h-full min-h-[600px] ${TOOLBAR_STYLES}`}>
      <Calendar
        localizer={localizer}
        events={events}
        view={view}
        onView={onView}
        date={date}
        onNavigate={onNavigate}
        views={["month", "week", "day"]}
        selectable
        popup
        onSelectEvent={(ev) => onSelectEntry(ev.entry)}
        onSelectSlot={(slot: SlotInfo) => onSelectSlot(slot.start)}
        eventPropGetter={(ev) => ({
          style: {
            backgroundColor: PLATFORM_META[ev.entry.platforms[0]]?.color ?? "#6366F1",
            borderRadius: "6px",
            border: "none",
            color: "#fff",
            fontSize: "12px",
            padding: "2px 4px",
          },
        })}
        components={{
          event: ({ event }) => (
            <span className="block truncate font-medium" title={event.title}>
              {event.title}
            </span>
          ),
        }}
        style={{ height: "100%" }}
      />
    </div>
  );
}
