import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/settings/organization", label: "Organization" },
  { to: "/settings/social-accounts", label: "Social Accounts" },
  { to: "/settings/platform-apps", label: "Platform Apps" },
  { to: "/settings/ai-provider", label: "AI Provider" },
];

export default function SettingsNav() {
  return (
    <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
      {TABS.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            `-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              isActive ? "border-primary-500 text-primary-600" : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
