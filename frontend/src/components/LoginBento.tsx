import type { CSSProperties, ReactNode } from "react";
import { ArrowUpRight, CalendarClock, CheckCircle2, Heart, MessageCircle, ThumbsUp } from "lucide-react";
import PlatformIcon from "@/components/PlatformIcon";

function Tile({ className, delay, children }: { className: string; delay: number; children: ReactNode }) {
  const style: CSSProperties = { animation: `tile-in .7s cubic-bezier(.2,.8,.2,1) ${delay}ms both` };
  return (
    <div className={`group overflow-hidden rounded-[1.75rem] p-5 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-0.6deg] ${className}`} style={style}>
      {children}
    </div>
  );
}

const DAYS = Array.from({ length: 28 }, (_, i) => i + 1);
const POST_DAYS = new Set([3, 6, 10, 13, 17, 20, 24]);

/** Colour-block bento collage for the sign-in screen (large screens). */
export default function LoginBento() {
  return (
    <div className="relative hidden bg-[#f3f1ec] p-8 lg:block xl:p-12">
      <div className="grid h-full grid-cols-6 grid-rows-6 gap-4">
        {/* headline */}
        <Tile delay={0} className="relative col-span-4 row-span-3 flex flex-col justify-between bg-[#1877F2] text-white">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
          <div className="absolute -bottom-16 right-16 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative flex -space-x-2">
            <PlatformIcon platform="FACEBOOK" size={16} />
            <PlatformIcon platform="INSTAGRAM" size={16} />
            <PlatformIcon platform="LINKEDIN" size={16} />
          </div>
          <div className="relative">
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight xl:text-5xl">
              Post once.
              <br />
              Shine everywhere.
            </h2>
            <p className="mt-3 max-w-sm text-sm text-white/80">Create, schedule and track posts across Facebook, Instagram and LinkedIn from one workspace.</p>
          </div>
        </Tile>

        {/* growth stat */}
        <Tile delay={90} className="col-span-2 row-span-2 flex flex-col justify-between bg-[#FFD84D] text-slate-900">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white">
            <ArrowUpRight size={18} />
          </span>
          <div>
            <p className="text-4xl font-semibold tracking-tight">+248%</p>
            <p className="text-sm font-medium text-slate-800/70">Reach growth</p>
          </div>
        </Tile>

        {/* instagram */}
        <Tile delay={180} className="col-span-2 row-span-2 flex flex-col justify-end bg-[linear-gradient(160deg,#FEDA75_0%,#D62976_55%,#4F5BD5_100%)] text-white">
          <div className="mb-auto self-start rounded-full bg-white/25 px-2.5 py-1 text-[11px] font-semibold backdrop-blur">Instagram</div>
          <p className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
            <Heart size={26} className="fill-white" /> 12.4k
          </p>
          <p className="text-sm text-white/80">likes this month</p>
        </Tile>

        {/* calendar */}
        <Tile delay={270} className="col-span-2 row-span-3 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-800">This month</span>
            <CalendarClock size={16} className="text-slate-400" />
          </div>
          <div className="mt-4 grid grid-cols-7 gap-1.5">
            {DAYS.map((d) => (
              <span
                key={d}
                className={`flex aspect-square items-center justify-center rounded-lg text-[10px] ${POST_DAYS.has(d) ? "bg-primary-500 font-semibold text-white" : "bg-slate-50 text-slate-400"}`}
              >
                {d}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">{POST_DAYS.size} posts scheduled</p>
        </Tile>

        {/* linkedin */}
        <Tile delay={360} className="col-span-2 row-span-2 flex flex-col justify-between bg-[#0A66C2] text-white">
          <div className="flex items-center gap-2">
            <PlatformIcon platform="LINKEDIN" size={14} />
            <span className="text-xs font-semibold">LinkedIn</span>
          </div>
          <div className="space-y-2">
            <span className="block h-2 w-full rounded-full bg-white/30" />
            <span className="block h-2 w-4/5 rounded-full bg-white/30" />
            <span className="block h-2 w-3/5 rounded-full bg-white/30" />
          </div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ThumbsUp size={14} /> 1,086 reactions
          </p>
        </Tile>

        {/* comment */}
        <Tile delay={450} className="col-span-2 row-span-1 flex items-center gap-3 !p-4 bg-white">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-[#fd8d32] to-[#c13584] text-xs font-bold text-white">A</span>
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-[11px] text-slate-400">
              <MessageCircle size={11} /> 86 comments
            </p>
            <p className="truncate text-sm font-medium text-slate-800">&ldquo;Love this launch!&rdquo;</p>
          </div>
        </Tile>

        {/* scheduled */}
        <Tile delay={540} className="col-span-2 row-span-1 flex items-center gap-3 !p-4 bg-[#10B981] text-white">
          <CheckCircle2 size={26} />
          <div>
            <p className="text-sm font-semibold">Scheduled</p>
            <p className="text-xs text-white/80">Tomorrow, 9:30 AM</p>
          </div>
        </Tile>
      </div>
    </div>
  );
}
