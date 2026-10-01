import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, ChevronDown, Download, FileSpreadsheet, FileText, FileType2, Search } from "lucide-react";
import toast from "@/lib/toast";
import { api } from "@/lib/api";
import { ALL_PLATFORMS, Platform } from "@/lib/types";
import PlatformIcon from "@/components/PlatformIcon";

export const RANGES: { key: string; label: string; days?: number }[] = [
  { key: "today", label: "Today", days: 0 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "custom", label: "Custom" },
  { key: "all", label: "All time" },
];

export interface StatusOption {
  key: string;
  label: string;
  dot?: string;
}

export const POST_STATUSES: StatusOption[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Drafts", dot: "bg-gray-400" },
  { key: "SCHEDULED", label: "Scheduled", dot: "bg-sky-500" },
  { key: "PUBLISHED", label: "Published", dot: "bg-emerald-500" },
  { key: "PARTIALLY_PUBLISHED", label: "Partially Published", dot: "bg-amber-500" },
  { key: "FAILED", label: "Failed", dot: "bg-red-500" },
];

export const JOB_STATUSES: StatusOption[] = [
  { key: "ALL", label: "All" },
  { key: "SUCCESS", label: "Success", dot: "bg-emerald-500" },
  { key: "PENDING", label: "Pending", dot: "bg-gray-400" },
  { key: "RETRYING", label: "Retrying", dot: "bg-amber-500" },
  { key: "FAILED", label: "Failed", dot: "bg-red-500" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export interface FilterState {
  search: string;
  status: string;
  platform: string;
  range: string;
  customFrom: string;
  customTo: string;
}

/** Filter state + the API query params it produces (debounced search, local-midnight date bounds). */
export function useFilters(onChange?: () => void, statusKey = "status_filter", initialRange = "today") {
  const [state, setState] = useState<FilterState>({ search: "", status: "ALL", platform: "ALL", range: initialRange, customFrom: "", customTo: "" });
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(state.search.trim()), 300);
    return () => clearTimeout(t);
  }, [state.search]);

  const set = (patch: Partial<FilterState>) => {
    setState((s) => ({ ...s, ...patch }));
    onChange?.();
  };

  const params: Record<string, string> = {};
  if (debounced) params.search = debounced;
  if (state.status !== "ALL") params[statusKey] = state.status;
  if (state.platform !== "ALL") params.platform = state.platform;
  const days = RANGES.find((r) => r.key === state.range)?.days;
  if (days !== undefined) {
    const from = startOfDay(new Date());
    from.setDate(from.getDate() - (days === 0 ? 0 : days - 1));
    params.date_from = from.toISOString();
  } else if (state.range === "custom") {
    if (state.customFrom) params.date_from = startOfDay(new Date(`${state.customFrom}T00:00`)).toISOString();
    if (state.customTo) {
      const to = startOfDay(new Date(`${state.customTo}T00:00`));
      to.setDate(to.getDate() + 1);
      params.date_to = to.toISOString();
    }
  }
  return { state, set, params };
}

function Pills({ options, value, onChange }: {
  options: { id: string; label: string; dot?: string; icon?: ReactNode }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full border border-gray-200 bg-gray-50 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
            o.id === value ? "bg-white text-primary-700 shadow-sm ring-1 ring-primary-200" : "text-gray-500 hover:text-gray-800"
          }`}
        >
          {o.dot && <span className={`h-2 w-2 rounded-full ${o.dot}`} />}
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Date-range dropdown (with custom from/to inputs) for pages that don't need the full filter panel. */
export function RangePicker({ filters }: { filters: ReturnType<typeof useFilters> }) {
  const { state, set } = filters;
  const dateInput = "rounded-full border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <CalendarDays size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <select
          value={state.range}
          onChange={(e) => set({ range: e.target.value })}
          className="cursor-pointer appearance-none rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm font-medium text-gray-700 focus:border-primary-500 focus:outline-none"
        >
          {RANGES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
      </div>
      {state.range === "custom" && (
        <>
          <input type="date" value={state.customFrom} max={state.customTo || undefined} onChange={(e) => set({ customFrom: e.target.value })} aria-label="From date" className={dateInput} />
          <span className="text-sm text-gray-400">to</span>
          <input type="date" value={state.customTo} min={state.customFrom || undefined} onChange={(e) => set({ customTo: e.target.value })} aria-label="To date" className={dateInput} />
        </>
      )}
    </div>
  );
}

const FORMAT_OPTIONS = [
  { fmt: "pdf", label: "PDF document", icon: FileType2 },
  { fmt: "xlsx", label: "Excel workbook", icon: FileSpreadsheet },
  { fmt: "csv", label: "CSV file", icon: FileText },
];

/** Downloads the report for the given endpoint using the current filters. */
export function DownloadMenu({ endpoint, params }: { endpoint: string; params: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  async function download(fmt: string) {
    setBusy(fmt);
    try {
      const res = await api.get(endpoint, { params: { ...params, format: fmt }, responseType: "blob" });
      const name = /filename="?([^";]+)"?/.exec(res.headers["content-disposition"] ?? "")?.[1] ?? `report.${fmt}`;
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Your ${fmt.toUpperCase()} report has been downloaded.`);
      setOpen(false);
    } catch {
      toast.error("We couldn't generate the report. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
      >
        <Download size={15} /> Download <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
          {FORMAT_OPTIONS.map(({ fmt, label, icon: Icon }) => (
            <button
              key={fmt}
              type="button"
              disabled={busy !== null}
              onClick={() => download(fmt)}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Icon size={16} className="text-gray-400" />
              {busy === fmt ? "Preparing..." : label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterPanel({
  filters,
  statuses,
  searchPlaceholder,
  reportEndpoint,
}: {
  filters: ReturnType<typeof useFilters>;
  statuses: StatusOption[];
  searchPlaceholder: string;
  reportEndpoint: string;
}) {
  const { state, set, params } = filters;
  return (
    <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={state.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder={searchPlaceholder}
            className="w-full rounded-full border border-gray-200 bg-gray-50 py-2.5 pl-11 pr-4 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
          />
        </div>
        <div className="relative">
          <CalendarDays size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <select
            value={state.range}
            onChange={(e) => set({ range: e.target.value })}
            className="cursor-pointer appearance-none rounded-full border border-gray-200 bg-white py-2.5 pl-10 pr-9 text-sm font-medium text-gray-700 focus:border-primary-500 focus:outline-none"
          >
            {RANGES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
        </div>
        {state.range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={state.customFrom}
              max={state.customTo || undefined}
              onChange={(e) => set({ customFrom: e.target.value })}
              aria-label="From date"
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
            <span className="text-sm text-gray-400">to</span>
            <input
              type="date"
              value={state.customTo}
              min={state.customFrom || undefined}
              onChange={(e) => set({ customTo: e.target.value })}
              aria-label="To date"
              className="rounded-full border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
            />
          </div>
        )}
        <DownloadMenu endpoint={reportEndpoint} params={params} />
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-gray-100 pt-4 lg:flex-row lg:gap-10">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Status</p>
          <Pills value={state.status} onChange={(status) => set({ status })} options={statuses.map((s) => ({ id: s.key, label: s.label, dot: s.dot }))} />
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">Platform</p>
          <Pills
            value={state.platform}
            onChange={(platform) => set({ platform })}
            options={[
              { id: "ALL", label: "All" },
              ...ALL_PLATFORMS.map((p: Platform) => ({ id: p, label: p.charAt(0) + p.slice(1).toLowerCase(), icon: <PlatformIcon platform={p} size={14} /> })),
            ]}
          />
        </div>
      </div>
    </div>
  );
}
