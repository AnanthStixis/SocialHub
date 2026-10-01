import type { ReactElement } from "react";
import hot from "react-hot-toast";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

type Kind = "success" | "error" | "warning" | "info";

const STYLE: Record<Kind, { icon: ReactElement; tile: string; bar: string; title: string; duration: number }> = {
  success: { icon: <CheckCircle2 size={20} />, tile: "bg-emerald-100 text-emerald-600", bar: "bg-emerald-500", title: "Success", duration: 4000 },
  error: { icon: <XCircle size={20} />, tile: "bg-red-100 text-red-600", bar: "bg-red-500", title: "Something went wrong", duration: 7000 },
  warning: { icon: <AlertTriangle size={20} />, tile: "bg-amber-100 text-amber-600", bar: "bg-amber-500", title: "Heads up", duration: 6000 },
  info: { icon: <Info size={20} />, tile: "bg-blue-100 text-blue-600", bar: "bg-blue-500", title: "Notice", duration: 5000 },
};

function show(kind: Kind, message: string) {
  const s = STYLE[kind];
  return hot.custom(
    (t) => (
      <div
        role="alert"
        className={`pointer-events-auto relative flex w-[380px] max-w-[92vw] overflow-hidden rounded-xl border bg-white shadow-xl ${
          kind === "error" ? "border-red-200" : kind === "warning" ? "border-amber-200" : "border-gray-200"
        } ${t.visible ? "animate-enter" : "animate-leave"}`}
      >
        <span className={`w-1.5 shrink-0 ${s.bar}`} />
        <span className={`toast-progress absolute bottom-0 left-0 h-1 w-full origin-left ${s.bar} opacity-70`} style={{ animationDuration: `${s.duration}ms` }} />
        <div className="flex flex-1 items-start gap-3 p-3.5">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${s.tile}`}>{s.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-gray-900">{s.title}</p>
            <p className="mt-0.5 text-sm leading-snug text-gray-600">{message}</p>
          </div>
          <button type="button" onClick={() => hot.dismiss(t.id)} aria-label="Dismiss" className="cursor-pointer text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>
      </div>
    ),
    { duration: s.duration },
  );
}

const toast = Object.assign((message: string) => show("info", message), {
  success: (m: string) => show("success", m),
  error: (m: string) => show("error", m),
  warning: (m: string) => show("warning", m),
  info: (m: string) => show("info", m),
});

export default toast;
