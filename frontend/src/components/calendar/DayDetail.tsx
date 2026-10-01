import { format } from "date-fns";
import { Edit3, Trash2 } from "lucide-react";
import { CalendarEntry } from "@/lib/types";
import PlatformIcon from "@/components/PlatformIcon";
import { Badge, Button, Modal } from "@/components/ui";
import { entryDate } from "./ContentCalendar";

const STATUS_VARIANT: Record<string, "default" | "info" | "success" | "danger" | "warning"> = {
  SCHEDULED: "info",
  PUBLISHED: "success",
  PARTIALLY_PUBLISHED: "warning",
  FAILED: "danger",
};

export default function DayDetail({
  date,
  entries,
  isOpen,
  onClose,
  onEdit,
  onDelete,
}: {
  date: Date | null;
  entries: CalendarEntry[];
  isOpen: boolean;
  onClose: () => void;
  onEdit: (e: CalendarEntry) => void;
  onDelete: (e: CalendarEntry) => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={date ? format(date, "EEEE, MMMM d, yyyy") : "Day Detail"} size="lg">
      {entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500">No posts scheduled for this day.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {entries.map((e) => (
            <div key={e.post_id} className="rounded-lg border border-gray-100 bg-gray-50/50 p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={STATUS_VARIANT[e.status] ?? "default"}>{e.status.replace(/_/g, " ")}</Badge>
                  <span className="text-xs text-gray-500">{format(entryDate(e), "h:mm a")}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(e)} aria-label="Edit post">
                    <Edit3 size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDelete(e)} aria-label="Delete post">
                    <Trash2 size={14} className="text-red-500" />
                  </Button>
                </div>
              </div>
              <p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-900">{e.idea}</p>
              <div className="flex items-center gap-1.5">
                {e.platforms.map((p) => (
                  <PlatformIcon key={p} platform={p} size={12} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
