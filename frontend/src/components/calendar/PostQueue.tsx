import { format } from "date-fns";
import { Clock } from "lucide-react";
import { CalendarEntry } from "@/lib/types";
import PlatformIcon from "@/components/PlatformIcon";

export default function PostQueue({
  entries,
  onSelect,
}: {
  entries: CalendarEntry[];
  onSelect: (e: CalendarEntry) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <Clock size={20} className="text-gray-400" />
        </div>
        <p className="mb-1 text-sm font-medium text-gray-900">No scheduled posts</p>
        <p className="text-xs text-gray-500">Schedule posts to see them here</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((e) => (
        <button
          key={e.post_id}
          onClick={() => onSelect(e)}
          className="w-full cursor-pointer rounded-lg border border-gray-100 p-3 text-left transition-colors hover:border-gray-200 hover:bg-gray-50"
        >
          <div className="mb-2 flex items-center gap-2">
            <Clock size={14} className="shrink-0 text-gray-400" />
            <span className="text-xs font-medium text-gray-600">
              {format(new Date(e.scheduled_at!), "MMM d, yyyy h:mm a")}
            </span>
          </div>
          <p className="mb-2 line-clamp-2 text-sm leading-snug text-gray-900">{e.idea}</p>
          <div className="flex items-center gap-1.5">
            {e.platforms.map((p) => (
              <PlatformIcon key={p} platform={p} size={12} />
            ))}
          </div>
        </button>
      ))}
    </div>
  );
}
