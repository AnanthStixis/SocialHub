import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  PenSquare,
  Calendar,
  Send,
  FileText,
  Building2,
  BarChart3,
  Users,
  Mail,
  Settings,
  Bell,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { isAdmin, useAuthStore } from "@/store/auth";
import Wordmark from "@/components/Wordmark";
import UserMenu, { Avatar } from "@/components/UserMenu";
import { useOrganization } from "@/lib/organization";
import { nameParts, roleLabel } from "@/lib/user";
import { api } from "@/lib/api";
import type { Page, Post } from "@/lib/types";
import { htmlToPlain } from "@/lib/richText";

// adminOnly items are hidden from (and blocked for) the Publisher role.
const navItems: { to: string; label: string; icon: typeof Send; group: string; adminOnly?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, group: "Workspace" },
  { to: "/compose", label: "Create Post", icon: PenSquare, group: "Workspace" },
  { to: "/calendar", label: "Calendar", icon: Calendar, group: "Workspace" },
  { to: "/posts", label: "All Posts", icon: FileText, group: "Workspace" },
  { to: "/publishing", label: "Publishing", icon: Send, group: "Insights" },
  { to: "/analytics", label: "Analytics", icon: BarChart3, group: "Insights" },
  { to: "/team", label: "Team & Roles", icon: Users, group: "Manage", adminOnly: true },
  { to: "/email-template", label: "Email Template", icon: Mail, group: "Manage", adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings, group: "Manage", adminOnly: true },
];

function HeaderSearch() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(text.trim()), 250);
    return () => clearTimeout(t);
  }, [text]);

  useEffect(() => {
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const { data, isFetching } = useQuery({
    queryKey: ["header-search", term],
    queryFn: async () => (await api.get<Page<Post>>("/posts", { params: { search: term, page_size: 6 } })).data.items,
    enabled: term.length >= 2,
  });

  function go(id: string) {
    setOpen(false);
    setText("");
    navigate(`/compose/${id}`);
  }

  return (
    <div ref={box} className="relative w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          setHighlight(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          const n = data?.length ?? 0;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlight((h) => (h + 1) % Math.max(n, 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlight((h) => (h <= 0 ? n - 1 : h - 1));
          } else if (e.key === "Enter") {
            if (data?.[highlight]) go(data[highlight].id);
            else if (data?.[0]) go(data[0].id);
          } else if (e.key === "Escape") setOpen(false);
        }}
        placeholder="Search posts..."
        className="w-full rounded-[10px] border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm transition-colors placeholder:text-gray-400 hover:border-gray-300 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      {open && term.length >= 2 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          {isFetching && !data && <p className="px-4 py-3 text-sm text-gray-400">Searching...</p>}
          {data?.length === 0 && <p className="px-4 py-3 text-sm text-gray-400">No posts match "{term}"</p>}
          {data?.map((p, i) => {
            const snippet = htmlToPlain(p.platforms.find((x) => x.content)?.content ?? "", { styled: false }).replace(/\s+/g, " ").trim();
            return (
              <button
                key={p.id}
                type="button"
                onMouseEnter={() => setHighlight(i)}
                onClick={() => go(p.id)}
                className={`flex w-full cursor-pointer flex-col items-start gap-0.5 px-4 py-2.5 text-left ${i === highlight ? "bg-primary-50" : "hover:bg-gray-50"}`}
              >
                <span className="flex w-full items-center justify-between gap-3">
                  <span className="truncate text-sm font-medium text-gray-900">{p.idea}</span>
                  <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                    {p.status.replace(/_/g, " ")}
                  </span>
                </span>
                {snippet && <span className="line-clamp-1 w-full text-xs text-gray-500">{snippet}</span>}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/posts");
            }}
            className="w-full cursor-pointer border-t border-gray-100 px-4 py-2 text-left text-xs font-medium text-primary-600 hover:bg-gray-50"
          >
            Browse all posts →
          </button>
        </div>
      )}
    </div>
  );
}

function useActive() {
  const { pathname } = useLocation();
  return (to: string) => (to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/"));
}

function useNavItems() {
  const admin = isAdmin(useAuthStore((s) => s.user));
  return navItems.filter((n) => admin || !n.adminOnly);
}

function SidebarUser({ collapsed }: { collapsed: boolean }) {
  const user = useAuthStore((s) => s.user);
  const { first, last } = nameParts(user);
  const name = `${first} ${last}`.trim() || user?.full_name || "";
  return (
    <div
      className={`mx-3 mb-3 flex items-center gap-3 rounded-xl border border-primary-100 bg-primary-50 p-2.5 ${collapsed ? "justify-center" : ""}`}
      title={collapsed ? `${name} · ${roleLabel(user)}` : undefined}
    >
      <Avatar size={34} />
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-primary">{name}</p>
          <p className="truncate text-xs text-primary/70">{roleLabel(user)}</p>
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const isActive = useActive();
  const items = useNavItems();
  const groups = [...new Set(items.map((i) => i.group))];
  return (
    <aside className={`relative hidden shrink-0 flex-col border-r border-gray-200 bg-white transition-all duration-300 md:flex ${collapsed ? "w-[72px]" : "w-64"}`}>
      <div className={`flex h-16 items-center gap-2.5 px-4 ${collapsed ? "justify-center" : ""}`}>
        <img src="/logo.svg" alt="" className="h-9 w-9 shrink-0 rounded-[10px] shadow-[0_2px_8px_rgba(15,118,110,0.3)]" />
        {!collapsed && <Wordmark className="text-[18px]" />}
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g}>
            {!collapsed && <p className="mb-1.5 px-3 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-gray-400">{g}</p>}
            <ul className="space-y-0.5">
              {items
                .filter((i) => i.group === g)
                .map(({ to, label, icon: Icon }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      title={collapsed ? label : undefined}
                      className={`group flex items-center gap-3 rounded-[10px] px-3 py-2 text-sm font-medium transition-colors duration-150 ${collapsed ? "justify-center" : ""} ${
                        isActive(to) ? "bg-nav-active text-primary shadow-[inset_3px_0_0_var(--color-primary)]" : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className={`h-[18px] w-[18px] shrink-0 ${isActive(to) ? "text-primary" : "text-gray-400 group-hover:text-gray-600"}`} />
                      {!collapsed && <span>{label}</span>}
                    </NavLink>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </nav>
      <SidebarUser collapsed={collapsed} />
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3 top-5 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 shadow-sm transition-colors hover:text-gray-700"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
    </aside>
  );
}

function MobileNav() {
  const isActive = useActive();
  const items = useNavItems();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around gap-1 overflow-x-auto border-t border-gray-200 bg-white px-2 md:hidden">
      {items.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={`flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors ${
            isActive(to) ? "text-primary-600" : "text-gray-400 hover:text-gray-600"
          }`}
        >
          <Icon className="h-5 w-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export default function AppLayout() {
  const navigate = useNavigate();
  const org = useOrganization();
  const [collapsed, setCollapsed] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => (await api.get<{ unread: number }>("/notifications/unread-count")).data,
    refetchInterval: 30000,
  });


  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className="relative flex flex-1 flex-col overflow-hidden">
        <header className="relative z-40 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-6">
          <div className="mr-2 hidden shrink-0 items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-sm font-medium text-primary lg:flex" title="Organization">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="max-w-[200px] truncate">{org.name}</span>
          </div>
          <div className="hidden max-w-md flex-1 md:flex">
            <HeaderSearch />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/notifications")}
              className="relative rounded-[10px] border border-gray-200 bg-white p-2 text-gray-500 transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {!!unread?.unread && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
                  {unread.unread}
                </span>
              )}
            </button>
            <UserMenu />
          </div>
        </header>
        <main className="relative flex-1 overflow-y-auto bg-background px-6 py-8 pb-24 md:pb-8">
          <div className="mx-auto w-full max-w-[1320px]">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
