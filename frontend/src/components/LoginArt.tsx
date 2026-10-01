import type { ReactNode } from "react";
import { Activity, BarChart3, CalendarClock, FileText, Heart, MessageCircle, Sparkles, ThumbsUp, TrendingUp, Users } from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";
import type { Platform } from "@/lib/types";

const GLASS = "absolute rounded-2xl border border-white/80 bg-white/60 p-4 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.22)] backdrop-blur-xl";

function Widget({ className, children }: { className: string; children: ReactNode }) {
  return <div className={`${GLASS} ${className}`}>{children}</div>;
}

function Orbit({ r, duration, reverse, items }: { r: number; duration: number; reverse?: boolean; items: { platform: Platform; angle: number }[] }) {
  return (
    <div className="absolute left-1/2 top-1/2" style={{ width: r * 2, height: r * 2, marginLeft: -r, marginTop: -r }}>
      <div className="absolute inset-0 rounded-full border border-dashed border-slate-300/70" />
      <div className="absolute inset-0" style={{ animation: `orbit-spin ${duration}s linear infinite ${reverse ? "reverse" : ""}` }}>
        {items.map(({ platform, angle }) => (
          <div
            key={platform}
            className="absolute left-1/2 top-1/2"
            style={{ transform: `rotate(${angle}deg) translateY(-${r}px)` }}
          >
            <div style={{ transform: `rotate(${-angle}deg)` }}>
              <div className="-ml-5 -mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-lg shadow-slate-300/60 ring-1 ring-white" style={{ animation: `orbit-spin ${duration}s linear infinite ${reverse ? "" : "reverse"}` }}>
                <PlatformIcon platform={platform} size={16} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniKpi({ icon, tone, label, value, delta, className, delay }: { icon: ReactNode; tone: string; label: string; value: string; delta: string; className: string; delay: string }) {
  return (
    <div
      className={`absolute hidden items-center gap-2.5 rounded-xl border border-white/80 bg-white/75 py-2 pl-2 pr-3 opacity-0 shadow-[0_8px_24px_-8px_rgba(15,23,42,0.25)] backdrop-blur-xl md:flex ${className}`}
      style={{ animation: `kpi-chip 8s ease-in-out infinite ${delay}` }}
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</span>
      <div className="leading-tight">
        <p className="text-[10px] font-medium text-slate-500">{label}</p>
        <p className="flex items-baseline gap-1.5 text-sm font-semibold text-slate-800">
          {value}
          <span className="text-[10px] font-semibold text-emerald-600">{delta}</span>
        </p>
      </div>
    </div>
  );
}

function Rise({ icon, className, delay }: { icon: ReactNode; className: string; delay: string }) {
  return (
    <span className={`absolute flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-lg shadow-slate-300/50 ${className}`} style={{ animation: `rise 7s ease-in infinite ${delay}` }}>
      {icon}
    </span>
  );
}

/** Light aurora backdrop for the sign-in screen: drifting colour, orbiting platform icons and glass analytics widgets. */
export default function LoginArt() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-[#f6f7fb]" aria-hidden>
      {/* aurora */}
      <div className="absolute -left-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sky-300/40 blur-[110px]" style={{ animation: "aurora-a 18s ease-in-out infinite" }} />
      <div className="absolute -right-32 top-10 h-[30rem] w-[30rem] rounded-full bg-pink-300/40 blur-[110px]" style={{ animation: "aurora-b 22s ease-in-out infinite" }} />
      <div className="absolute -bottom-48 left-1/3 h-[32rem] w-[32rem] rounded-full bg-teal-300/40 blur-[110px]" style={{ animation: "aurora-a 26s ease-in-out infinite reverse" }} />
      <div className="absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-amber-200/50 blur-[100px]" style={{ animation: "aurora-b 20s ease-in-out infinite" }} />
      <div
        className="absolute inset-0 opacity-[0.55]"
        style={{ backgroundImage: "linear-gradient(rgb(148 163 184 / 0.18) 1px, transparent 1px), linear-gradient(90deg, rgb(148 163 184 / 0.18) 1px, transparent 1px)", backgroundSize: "56px 56px", maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)" }}
      />

      {/* orbits */}
      <div className="absolute left-1/2 top-1/2 hidden h-0 w-0 md:block lg:left-[72%]">
        <Orbit r={300} duration={60} items={[{ platform: "FACEBOOK", angle: 40 }, { platform: "LINKEDIN", angle: 220 }]} />
        <Orbit r={420} duration={90} reverse items={[{ platform: "INSTAGRAM", angle: 120 }, { platform: "FACEBOOK", angle: 300 }]} />
      </div>

      {/* rising reactions */}
      <Rise icon={<Heart size={16} className="fill-rose-500 text-rose-500" />} className="bottom-0 left-[58%] hidden lg:flex" delay="0s" />
      <Rise icon={<ThumbsUp size={16} className="text-sky-500" />} className="bottom-0 left-[70%] hidden lg:flex" delay="2.4s" />
      <Rise icon={<MessageCircle size={16} className="text-teal-600" />} className="bottom-0 right-[30%] hidden lg:flex" delay="4.6s" />
      <Rise icon={<Sparkles size={16} className="text-amber-500" />} className="bottom-0 right-[12%] hidden lg:flex" delay="1.2s" />

      {/* small KPI chips that fade in, drift up and fade out in turn */}
      <MiniKpi icon={<FileText size={15} />} tone="bg-sky-50 text-sky-600" label="Posts" value="128" delta="+12%" className="right-[3%] top-[12%]" delay="0s" />
      <MiniKpi icon={<Heart size={15} className="fill-rose-500" />} tone="bg-rose-50 text-rose-500" label="Likes" value="4.2k" delta="+8%" className="right-[3%] top-[50%]" delay="2s" />
      <MiniKpi icon={<Activity size={15} />} tone="bg-primary-50 text-primary-600" label="Engagement" value="78%" delta="+5%" className="right-[3%] bottom-[10%]" delay="4s" />
      <MiniKpi icon={<MessageCircle size={15} />} tone="bg-amber-50 text-amber-600" label="Comments" value="612" delta="+18%" className="left-[43%] top-[14%]" delay="6s" />

      {/* left widgets */}
      <Widget className="animate-float-slow left-[5%] top-[14%] hidden w-56 xl:hidden">
        <div className="flex items-center justify-between">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Users size={16} />
          </span>
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
            <TrendingUp size={11} /> 8.2%
          </span>
        </div>
        <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-800">12.4k</p>
        <p className="text-xs text-slate-500">Followers this month</p>
        <svg viewBox="0 0 200 50" className="mt-2 h-10 w-full" fill="none">
          <path d="M0 40 C 25 38, 35 20, 60 24 S 100 42, 125 26 S 170 6, 200 10" stroke="#0284c7" strokeWidth="2" strokeLinecap="round" />
          <path d="M0 40 C 25 38, 35 20, 60 24 S 100 42, 125 26 S 170 6, 200 10 L200 50 L0 50 Z" fill="url(#lg1)" opacity="0.25" />
          <defs>
            <linearGradient id="lg1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#0284c7" />
              <stop offset="1" stopColor="#0284c7" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </Widget>

      <Widget className="animate-float-slower bottom-[12%] left-[9%] hidden w-60 xl:hidden">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <CalendarClock size={17} />
          </span>
          <div>
            <p className="text-[11px] text-slate-500">Next post goes live</p>
            <p className="text-sm font-semibold text-slate-800">Today, 4:30 PM</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex -space-x-1.5">
            <PlatformIcon platform="FACEBOOK" size={12} />
            <PlatformIcon platform="INSTAGRAM" size={12} />
            <PlatformIcon platform="LINKEDIN" size={12} />
          </div>
          <span className="text-[11px] font-medium text-primary-600">in 2h 14m</span>
        </div>
      </Widget>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3.5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-md shadow-slate-300/40 ring-1 ring-slate-100">{icon}</span>
      <div>
        <p className="text-[15px] font-semibold text-slate-800">{title}</p>
        <p className="text-sm leading-relaxed text-slate-500">{text}</p>
      </div>
    </li>
  );
}

/** Brand copy shown to the left of the sign-in card on large screens. */
export function LoginHero() {
  return (
    <div className="absolute left-[6%] top-1/2 hidden w-[min(540px,44%)] -translate-y-1/2 lg:block">
      <span className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-white/80 px-3.5 py-1.5 text-sm font-semibold text-primary-700 shadow-sm backdrop-blur">
        <span className="h-2 w-2 rounded-full bg-primary-500" /> Social media management, simplified
      </span>
      <h2 className="mt-6 text-5xl font-semibold leading-[1.08] tracking-tight text-slate-900 xl:text-[3.5rem]">
        Every channel.
        <br />
        One <span className="bg-gradient-to-r from-[#1877F2] via-[#D62976] to-[#0A66C2] bg-clip-text text-transparent">workspace</span>.
      </h2>
      <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-500">Create, schedule and track posts across Facebook, Instagram and LinkedIn without switching tabs.</p>

      <ul className="mt-9 space-y-5">
        <Feature icon={<CalendarClock size={20} />} title="Plan and schedule" text="Line up a month of content in one calendar view." />
        <Feature icon={<Sparkles size={20} />} title="Write faster with AI" text="Draft from a topic or a link, then polish the tone." />
        <Feature icon={<BarChart3 size={20} />} title="See what works" text="Likes, comments and reach for every platform." />
      </ul>

      <div className="mt-10 flex items-center gap-4">
        <div className="flex -space-x-2">
          <PlatformIcon platform="FACEBOOK" size={16} />
          <PlatformIcon platform="INSTAGRAM" size={16} />
          <PlatformIcon platform="LINKEDIN" size={16} />
        </div>
        <p className="text-sm text-slate-500">Connect your pages and publish everywhere in one click.</p>
      </div>
    </div>
  );
}
