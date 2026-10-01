import type { ReactNode } from "react";
import clsx from "clsx";

export function Tabs({ tabs, activeTab, onChange }: {
  tabs: { id: string; label: ReactNode }[];
  activeTab: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === activeTab}
            onClick={() => onChange(t.id)}
            className={clsx(
              "cursor-pointer whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors duration-150",
              t.id === activeTab ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
