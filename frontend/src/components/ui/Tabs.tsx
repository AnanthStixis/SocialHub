import type { ReactNode } from "react";
import clsx from "clsx";

export function Tabs({ tabs, activeTab, onChange }: {
  tabs: { id: string; label: ReactNode }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={t.id === activeTab}
          onClick={() => onChange(t.id)}
          className={clsx(
            "cursor-pointer whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-sm font-medium transition-all duration-150",
            t.id === activeTab ? "bg-white text-primary shadow-[var(--shadow-card)] ring-1 ring-gray-200" : "text-gray-500 hover:text-gray-800",
          )}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
