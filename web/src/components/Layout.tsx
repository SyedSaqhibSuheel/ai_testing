import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  Code2,
  ClipboardList,
  ScanSearch,
  History,
  GitBranch,
  Activity,
  Settings as SettingsIcon,
  Sparkles,
  Menu,
  Boxes,
  ChevronDown,
} from "lucide-react";
import { ModeToggle } from "@/components/theme/ModeToggle";

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
      { to: "/applications", label: "Applications", icon: Boxes },
    ],
  },
  {
    label: "Test design",
    items: [
      { to: "/requirements", label: "Requirements", icon: FileText },
      { to: "/code-analysis", label: "Code Analysis", icon: ScanSearch },
      { to: "/test-case-management", label: "Test Case Management", icon: ClipboardList },
      { to: "/scenarios", label: "Scenarios", icon: ListChecks },
    ],
  },
  {
    label: "Execution",
    items: [
      { to: "/test-files", label: "Generated Tests", icon: Code2 },
      { to: "/test-history", label: "Test History", icon: History },
      { to: "/agents", label: "Agent Activity", icon: Activity },
    ],
  },
  {
    label: "Configuration",
    items: [
      { to: "/git", label: "Git", icon: GitBranch },
      { to: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

const NAV_STATE_KEY = "ai-testing-nav-collapsed";

function readCollapsed(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(NAV_STATE_KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { pathname } = useLocation();
  // Purely a per-browser display preference: which nav groups are folded.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(readCollapsed);
  const toggleGroup = (label: string) =>
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try {
        localStorage.setItem(NAV_STATE_KEY, JSON.stringify(next));
      } catch {
        // storage unavailable - the toggle still works for this session
      }
      return next;
    });
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });
  const { data: active } = useQuery({
    queryKey: ["active-application"],
    queryFn: api.getActiveApplication,
  });

  return (
    <div className="flex h-screen bg-bg text-text">
      {/* Sidebar */}
      <aside
        className={`
          ws-theme
          fixed inset-y-0 left-0 z-50
          flex w-64 shrink-0 flex-col
          border-r border-border
          bg-bg text-text
          transition-transform duration-300
          md:static md:z-auto md:translate-x-0
          ${mobileMenuOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-text">AI Testing</div>
              <div className="text-[11px] text-muted">Intelligent QA Platform</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, gi) => {
            const open = !collapsed[group.label];
            const containsActive = group.items.some((item) => (item.end ? pathname === item.to : pathname.startsWith(item.to)));
            return (
              <div key={group.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  aria-expanded={open}
                  className="group flex w-full items-center gap-2 rounded-lg px-3 py-2 mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted transition-colors hover:text-text"
                >
                  <span className="text-primary/80">{String(gi + 1).padStart(2, "0")}</span>
                  <span className="flex-1 text-left">{group.label}</span>
                  {!open && containsActive && <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--ws-primary,262_83%_65%))]" />}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${open ? "" : "-rotate-90"}`} />
                </button>
                <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
                  <div className="overflow-hidden">
                    <div className="space-y-1 pb-2 pt-0.5">
                      {group.items.map((item) => (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={() => setMobileMenuOpen(false)}
                          end={item.end}
                          tabIndex={open ? undefined : -1}
                          className={({ isActive }) =>
                            `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                              isActive
                                ? "bg-gradient-to-r from-primary/15 to-primary/[0.03] font-medium text-text ring-1 ring-inset ring-primary/20"
                                : "text-muted hover:bg-white/[0.04] hover:text-text"
                            }`
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {isActive && (
                                <span className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-accent shadow-[0_0_12px_2px_hsl(var(--ws-primary,262_83%_65%)/0.6)]" />
                              )}
                              <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? "text-primary" : "text-muted group-hover:text-text"}`} strokeWidth={1.75} />
                              <span className="truncate">{item.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="shrink-0 space-y-3 border-t border-border p-3">
          <div className="rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-pass" />
              </span>
              <span className="truncate text-sm font-medium text-text">{active?.application?.name ?? "No application set"}</span>
            </div>
            <div className="mt-1 pl-4 text-xs text-muted">
              {settings?.llmProvider ?? "..."} ·{" "}
              <span className="capitalize">{settings?.approvalMode?.replace(/_/g, " ") ?? "..."}</span> approval
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg px-3">
            <span className="text-xs text-muted">Theme</span>
            <ModeToggle />
          </div>
        </div>
      </aside>
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-bg/95 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-panel text-muted transition-colors hover:text-text"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ml-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Sparkles className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-sm font-semibold text-text">AI Testing</span>
          </div>
        </div>

        <Outlet />
      </main>
    </div>
  );
}
