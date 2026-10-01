import clsx from "clsx";
import { format } from "date-fns";
import { Calendar, Clock, Send } from "lucide-react";
import { Input } from "@/components/ui";

export type ScheduleMode = "now" | "schedule";

// datetime-local wants "yyyy-MM-ddTHH:mm" in local time.
const toInputValue = (d: Date | null) => (d ? format(d, "yyyy-MM-dd'T'HH:mm") : "");

export default function SchedulePicker({
  mode,
  onModeChange,
  scheduledAt,
  onChange,
}: {
  mode: ScheduleMode;
  onModeChange: (m: ScheduleMode) => void;
  scheduledAt: Date | null;
  onChange: (d: Date | null) => void;
}) {
  const modeBtn = (active: boolean) =>
    clsx(
      "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all duration-150",
      active ? "border-primary-500 bg-primary-500 text-white shadow-sm" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50",
    );

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button type="button" onClick={() => onModeChange("now")} className={modeBtn(mode === "now")}>
          <Send size={16} /> Post Now
        </button>
        <button type="button" onClick={() => onModeChange("schedule")} className={modeBtn(mode === "schedule")}>
          <Calendar size={16} /> Schedule
        </button>
      </div>

      {mode === "schedule" && (
        <div className="space-y-2">
          <Input
            type="datetime-local"
            aria-label="Schedule date and time"
            min={toInputValue(new Date())}
            value={toInputValue(scheduledAt)}
            onChange={(e) => onChange(e.target.value ? new Date(e.target.value) : null)}
            className="max-w-xs"
          />
          {scheduledAt && (
            <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2">
              <Clock size={16} className="shrink-0 text-primary-600" />
              <p className="text-sm text-primary-700">
                Scheduled for <span className="font-medium">{format(scheduledAt, "EEEE, MMMM d, yyyy 'at' h:mm a")}</span>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
