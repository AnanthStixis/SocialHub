import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";
import type { Platform } from "@/lib/types";

export type KpiTone = "blue" | "emerald" | "red" | "slate";

const TONES: Record<KpiTone, { tile: string; stroke: string; glow: string; ring: string }> = {
  blue: { tile: "bg-blue-50 text-blue-600", stroke: "#2563eb", glow: "hover:shadow-blue-200/70", ring: "hover:border-blue-300" },
  emerald: { tile: "bg-emerald-50 text-emerald-600", stroke: "#059669", glow: "hover:shadow-emerald-200/70", ring: "hover:border-emerald-300" },
  red: { tile: "bg-red-50 text-red-600", stroke: "#dc2626", glow: "hover:shadow-red-200/70", ring: "hover:border-red-300" },
  slate: { tile: "bg-slate-100 text-slate-600", stroke: "#475569", glow: "hover:shadow-slate-300/70", ring: "hover:border-slate-300" },
};

/** Counts up from 0 whenever the target changes. */
function useCountUp(target: number, ms = 700) {
  const decimals = Number.isInteger(target) ? 0 : 1;
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setN(Number((target * (1 - Math.pow(1 - p, 3))).toFixed(decimals)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

function Sparkline({ series, color, compact }: { series: number[]; color: string; compact?: boolean }) {
  const id = useId();
  const W = 120;
  const H = 44;
  const max = Math.max(1, ...series);
  const pts = series.map((v, i) => [(i / Math.max(1, series.length - 1)) * W, H - 4 - (v / max) * (H - 10)] as const);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={compact ? "h-8 w-20 overflow-visible" : "h-11 w-28 overflow-visible"} preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} className="kpi-area" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="kpi-line" />
      {pts.length > 0 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" fill={color} />}
    </svg>
  );
}

export default function KpiCard({
  label,
  hint,
  value,
  icon: Icon,
  tone,
  series,
  breakdown,
  badWhenUp = false,
  suffix = "",
  compact = false,
}: {
  label: string;
  hint: string;
  value: number;
  icon: ComponentType<{ size?: number }>;
  tone: KpiTone;
  series: number[];
  breakdown: Record<string, number>;
  badWhenUp?: boolean;
  suffix?: string;
  compact?: boolean;
}) {
  const t = TONES[tone];
  const shown = useCountUp(value);
  const [hover, setHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const last = series[series.length - 1] ?? 0;
  const prev = series[series.length - 2] ?? 0;
  const diff = last - prev;
  const dir = diff === 0 ? "flat" : diff > 0 ? "up" : "down";
  const good = dir === "flat" ? null : (dir === "up") !== badWhenUp;
  const pct = prev > 0 ? Math.round((Math.abs(diff) / prev) * 100) : null;
  const badge = good === null ? "bg-gray-100 text-gray-500" : good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700";
  const Arrow = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : ArrowRight;
  const rows = Object.entries(breakdown).filter(([, v]) => v > 0);

  return (
    <div
      ref={ref}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      tabIndex={0}
      className={`group relative cursor-default rounded-xl border border-gray-100 bg-white ${compact ? "p-3.5" : "p-5"} shadow-sm outline-none transition-all duration-300 hover:-translate-y-1 hover:shadow-xl focus-visible:-translate-y-1 focus-visible:shadow-xl ${t.glow} ${t.ring}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex ${compact ? "h-8 w-8" : "h-10 w-10"} items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6 ${t.tile}`}>
          <Icon size={compact ? 16 : 20} />
        </div>
        <span className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`} title="Change since yesterday">
          <Arrow size={13} />
          {pct !== null ? `${pct}%` : diff === 0 ? "0" : Math.abs(diff)}
        </span>
      </div>

      <div className={`${compact ? "mt-2" : "mt-3"} flex items-end justify-between gap-2`}>
        <div>
          <div className={`${compact ? "text-2xl" : "text-3xl"} font-semibold tabular-nums`}>{shown}{suffix}</div>
          <div className="mt-1 text-sm font-medium text-gray-700">{label}</div>
          <div className="text-xs text-gray-400">{hint}</div>
        </div>
        <Sparkline series={series} color={t.stroke} compact={compact} />
      </div>

      <div
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-52 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-2xl transition-all duration-200 ${
          hover ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Breakdown</p>
        {rows.length === 0 ? (
          <p className="text-xs text-gray-400">Nothing to show yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {rows.map(([platform, count]) => (
              <li key={platform} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-gray-700">
                  <PlatformIcon platform={platform as Platform} size={14} />
                  {platform.charAt(0) + platform.slice(1).toLowerCase()}
                </span>
                <span className="font-semibold tabular-nums text-gray-900">{count}{suffix}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-400">Daily trend · vs previous day</p>
      </div>
    </div>
  );
}
