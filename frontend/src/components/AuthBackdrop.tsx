import type { ReactNode } from "react";
import { BarChart3, CalendarClock, Heart, MessageCircle, Share2, TrendingUp, UserPlus } from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";
import type { Platform } from "@/lib/types";

const GLASS = "absolute rounded-2xl border border-white/70 bg-white/80 shadow-xl shadow-slate-300/40 backdrop-blur";

function PostChip({ platform, name, text, likes, comments, className }: { platform: Platform; name: string; text: string; likes: number; comments: number; className: string }) {
  return (
    <div className={`${GLASS} hidden w-60 p-3.5 md:block ${className}`}>
      <div className="flex items-center gap-2">
        <PlatformIcon platform={platform} size={14} />
        <span className="text-xs font-semibold text-slate-700">{name}</span>
        <span className="ml-auto text-[10px] text-slate-400">Just now</span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-500">{text}</p>
      <div className="mt-2.5 h-14 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200/70" />
      <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-400">
        <span className="flex items-center gap-1">
          <Heart size={12} className="text-rose-400" /> {likes}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle size={12} className="text-sky-400" /> {comments}
        </span>
        <Share2 size={12} className="ml-auto" />
      </div>
    </div>
  );
}

function Bubble({ platform, size, className }: { platform: Platform; size: number; className: string }) {
  return (
    <div className={`absolute hidden rounded-full bg-white/80 p-2.5 shadow-lg shadow-slate-300/50 ring-1 ring-white lg:block ${className}`}>
      <PlatformIcon platform={platform} size={size} />
    </div>
  );
}

function Pill({ children, className }: { children: ReactNode; className: string }) {
  return <span className={`absolute hidden rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs font-medium text-slate-500 shadow-sm backdrop-blur lg:block ${className}`}>{children}</span>;
}

/** Social-media themed backdrop for the sign-in screens: platform glows, floating post / schedule / analytics cards, rings and hashtags. */
export default function AuthBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden bg-slate-50" aria-hidden>
      {/* colour glows */}
      <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#1877F2]/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-[#E4405F]/20 blur-3xl" />
      <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-[#0A66C2]/15 blur-3xl" />
      <div className="absolute -bottom-24 left-1/4 h-72 w-72 rounded-full bg-[#FEDA75]/25 blur-3xl" />
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(rgb(148 163 184 / 0.35) 1px, transparent 1px)", backgroundSize: "24px 24px" }} />

      {/* concentric rings behind the sign-in card */}
      <svg className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 text-slate-300/50" viewBox="0 0 900 900" fill="none">
        {[150, 230, 320, 420].map((r) => (
          <circle key={r} cx="450" cy="450" r={r} stroke="currentColor" strokeDasharray={r % 20 === 0 ? "4 8" : undefined} />
        ))}
      </svg>

      {/* floating post cards */}
      <PostChip platform="FACEBOOK" name="Facebook" text="We just launched our new feature. Come take a look!" likes={248} comments={31} className="animate-float-slow left-[5%] top-[10%] -rotate-3" />
      <PostChip platform="INSTAGRAM" name="Instagram" text="Behind the scenes of this week's campaign shoot." likes={1204} comments={86} className="animate-float-slower bottom-[9%] right-[5%] rotate-2" />

      {/* scheduled post */}
      <div className={`${GLASS} animate-float-slower right-[7%] top-[12%] hidden items-center gap-3 px-4 py-3 lg:flex`}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
          <CalendarClock size={18} />
        </span>
        <div>
          <p className="text-[11px] text-slate-400">Scheduled for tomorrow</p>
          <p className="text-sm font-semibold text-slate-700">9:30 AM</p>
        </div>
        <div className="ml-2 flex -space-x-1.5">
          <PlatformIcon platform="FACEBOOK" size={12} />
          <PlatformIcon platform="INSTAGRAM" size={12} />
          <PlatformIcon platform="LINKEDIN" size={12} />
        </div>
      </div>

      {/* reach chart */}
      <div className={`${GLASS} animate-float-slow right-[2%] top-[40%] hidden w-44 p-3.5 xl:block`}>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <BarChart3 size={12} /> Reach
          </span>
          <span className="font-medium text-emerald-500">+24%</span>
        </div>
        <div className="mt-2 flex h-14 items-end gap-1.5">
          {[35, 55, 40, 70, 50, 85, 65].map((h, i) => (
            <span key={i} className="flex-1 rounded-t bg-primary-500/70" style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>

      {/* engagement chip */}
      <div className={`${GLASS} animate-float-slower bottom-[16%] left-[8%] hidden items-center gap-3 px-4 py-3 md:flex`}>
        <PlatformIcon platform="LINKEDIN" size={14} />
        <div>
          <p className="text-[11px] text-slate-400">Engagement this week</p>
          <p className="flex items-center gap-1 text-sm font-semibold text-slate-700">
            +18% <TrendingUp size={14} className="text-emerald-500" />
          </p>
        </div>
      </div>

      {/* new follower toast */}
      <div className={`${GLASS} animate-float-slow left-[4%] top-[46%] hidden items-center gap-2.5 px-3.5 py-2.5 xl:flex`}>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-50 text-sky-500">
          <UserPlus size={15} />
        </span>
        <div>
          <p className="text-xs font-semibold text-slate-700">New follower</p>
          <p className="text-[11px] text-slate-400">+128 this week</p>
        </div>
      </div>

      {/* platform bubbles */}
      <Bubble platform="FACEBOOK" size={16} className="animate-float-slower left-[27%] top-[7%]" />
      <Bubble platform="INSTAGRAM" size={14} className="animate-float-slow right-[30%] bottom-[5%]" />
      <Bubble platform="LINKEDIN" size={12} className="animate-float-slow right-[6%] top-[22%]" />

      {/* hashtags */}
      
      
      <Pill className="right-[24%] top-[7%] rotate-3">#growth</Pill>
      <Pill className="right-[4%] top-[58%] -rotate-3">#community</Pill>

      {/* tagline */}
      <p className="absolute inset-x-0 bottom-6 hidden text-center text-sm font-medium tracking-wide text-slate-400 md:block">Plan · Publish · Grow across every platform</p>
    </div>
  );
}
