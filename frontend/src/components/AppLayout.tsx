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
  Zap,
  Bell,
  Search,
  Plus,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { isAdmin, useAuthStore } from "@/store/auth";
import UserMenu, { Avatar } from "@/components/UserMenu";
import { useOrganization } from "@/lib/organization";
import { nameParts, roleLabel } from "@/lib/user";
import { api } from "@/lib/api";
import type { Page, Post } from "@/lib/types";
import { htmlToPlain } from "@/lib/richText";

// adminOnly items are hidden from (and blocked for) the Publisher role.
const navItems: { to: string; label: string; icon: typeof Send; adminOnly?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/compose", label: "Create Post", icon: PenSquare },
  { to: "/posts", label: "All Posts", icon: FileText },
  { to: "/calendar", label: "Calendar", icon: Calendar },
  { to: "/publishing", label: "Publishing", icon: Send },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/team", label: "Team & Roles", icon: Users, adminOnly: true },
  { to: "/email-template", label: "Email Template", icon: Mail, adminOnly: true },
  { to: "/settings", label: "Settings", icon: Settings, adminOnly: true },
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
        className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
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
    <div className={`flex items-center gap-3 border-t border-white/10 px-4 py-3 ${collapsed ? "justify-center px-0" : ""}`} title={collapsed ? `${name} · ${roleLabel(user)}` : undefined}>
      <Avatar size={34} />
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="truncate text-xs text-white/50">{roleLabel(user)}</p>
        </div>
      )}
    </div>
  );
}

function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const isActive = useActive();
  const items = useNavItems();
  return (
    <aside
      className={`hidden shrink-0 flex-col bg-sidebar text-white transition-all duration-300 md:flex ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-16 items-center gap-2 border-b border-white/10 px-4">
        <Zap className="h-6 w-6 shrink-0 text-primary-400" />
        {!collapsed && <span className="text-lg font-bold tracking-tight">Social Hub</span>}
      </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {items.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive(to)
                    ? "bg-sidebar-active text-white"
                    : "text-white/70 hover:bg-sidebar-hover hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <SidebarUser collapsed={collapsed} />
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex h-12 items-center justify-center border-t border-white/10 text-white/50 transition-colors hover:bg-sidebar-hover hover:text-white"
      >
        {collapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
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
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
          <div className="mr-4 hidden shrink-0 items-center gap-2 rounded-lg bg-primary-50 px-3 py-1.5 text-sm font-semibold text-primary-700 lg:flex" title="Organization">
            <Building2 className="h-4 w-4" />
            <span className="max-w-[200px] truncate">{org.name}</span>
          </div>
          <div className="hidden max-w-md flex-1 md:flex">
            <HeaderSearch />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/notifications")}
              className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {!!unread?.unread && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread.unread}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/compose")}
              className="hidden items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700 sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              New Post
            </button>
            <UserMenu />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-background p-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
