import { useEffect, useId, useRef, useState, type ComponentType } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";
import type { Platform } from "@/lib/types";

export type KpiTone = "blue" | "emerald" | "red" | "slate";

const TONES: Record<KpiTone, { tile: string; stroke: string; glow: string; ring: string }> = {
  blue: { tile: "bg-blue-light text-blue", stroke: "#2563eb", glow: "hover:shadow-blue-100", ring: "hover:border-blue-200" },
  emerald: { tile: "bg-success-light text-success", stroke: "#059669", glow: "hover:shadow-emerald-100", ring: "hover:border-emerald-200" },
  red: { tile: "bg-danger-light text-danger", stroke: "#dc2626", glow: "hover:shadow-red-100", ring: "hover:border-red-200" },
  slate: { tile: "bg-warning-light text-warning", stroke: "#d97706", glow: "hover:shadow-amber-100", ring: "hover:border-amber-200" },
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

function Sparkline({ series, color }: { series: number[]; color: string }) {
  const id = useId();
  const W = 96;
  const H = 32;
  const pad = 3;
  const data = series.length > 1 ? series : [0, 0];
  const max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - pad - (v / max) * (H - pad * 2)] as const);
  // Smooth line through the points (mid-point quadratic curves).
  let line = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [x, y] = pts[i];
    const mx = (px + x) / 2;
    line += ` Q${px.toFixed(1)},${py.toFixed(1)} ${mx.toFixed(1)},${((py + y) / 2).toFixed(1)}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  line += ` T${lx.toFixed(1)},${ly.toFixed(1)}`;
  const area = `${line} L${W},${H} L0,${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} preserveAspectRatio="none" className="shrink-0 overflow-visible" aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} className="kpi-area" />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="kpi-line" />
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
  const badge = good === null ? "bg-gray-50 text-gray-500 ring-1 ring-inset ring-gray-200" : good ? "bg-success-light text-success" : "bg-danger-light text-danger";
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
      className={`group relative cursor-default rounded-2xl border border-gray-200 bg-surface p-5 shadow-[var(--shadow-card)] outline-none transition-all duration-200 hover:-translate-y-px hover:shadow-md focus-visible:-translate-y-px focus-visible:shadow-md ${t.glow} ${t.ring}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.tile}`}>
            <Icon size={16} />
          </div>
          <span className="truncate text-sm font-medium text-gray-600">{label}</span>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${badge}`} title="Change since yesterday">
          <Arrow size={12} />
          {pct !== null ? `${pct}%` : diff === 0 ? "0" : Math.abs(diff)}
        </span>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <span className="text-[30px] font-bold leading-none tabular-nums tracking-tight text-gray-900">
          {shown}
          {suffix}
        </span>
        <Sparkline series={series} color={t.stroke} />
      </div>
      <div className="mt-2 truncate text-xs text-gray-400">{hint}</div>

      <div
        role="tooltip"
        className={`pointer-events-none absolute left-1/2 top-full z-30 mt-2 w-52 -translate-x-1/2 rounded-xl border border-gray-200 bg-white p-3 shadow-xl transition-all duration-200 ${
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
                <span className="font-semibold tabular-nums text-gray-900">
                  {count}
                  {suffix}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 border-t border-gray-100 pt-2 text-[11px] text-gray-400">Daily trend · vs previous day</p>
      </div>
    </div>
  );
}
