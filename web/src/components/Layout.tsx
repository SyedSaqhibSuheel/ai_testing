import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  Code2,
  History,
  GitBranch,
  Activity,
  Settings as SettingsIcon,
  Sparkles,
  Menu,
  X,
} from "lucide-react";
import { ModeToggle } from "@/components/theme/ModeToggle";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/requirements", label: "Requirements", icon: FileText },
  { to: "/scenarios", label: "Scenarios", icon: ListChecks },
  { to: "/test-files", label: "Generated Tests", icon: Code2 },
  { to: "/test-history", label: "Test History", icon: History },
  { to: "/git", label: "Git", icon: GitBranch },
  { to: "/agents", label: "Agent Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  return (
    <div className="flex h-screen bg-bg text-text">
      {/* Sidebar */}
      <aside
  className={`
    fixed inset-y-0 left-0 z-50
    w-64 shrink-0
    border-r border-border
    bg-bg/98
    flex flex-col
    transition-transform duration-300
    md:static md:z-auto md:translate-x-0
    ${
      mobileMenuOpen
        ? "translate-x-0"
        : "-translate-x-full"
    }
  `}
>
        {/* Brand */}
        <div className="h-16 px-4 flex items-center border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/20">
              <Sparkles className="h-4 w-4 text-white" />
            </div>

            <div className="min-w-0">
              <div className="text-sm font-semibold tracking-tight text-text">
                AI Testing
              </div>
              <div className="text-[11px] text-muted">
                Intelligent QA Platform
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="px-3 pt-5">
          <div className="px-2 mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-2">
            Workspace
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
             <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                end={item.end}
                className={({ isActive }) =>
                  `group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-purple-500/15 to-pink-500/10 text-text shadow-sm"
                      : "text-muted hover:bg-panel-2 hover:text-text"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-purple-400 to-pink-400" />
                    )}

                    <item.icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive
                          ? "text-purple-400"
                          : "text-muted group-hover:text-text"
                      }`}
                    />

                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom section */}
        <div className="mt-auto border-t border-border p-3">
          <div className="mb-3 rounded-xl border border-border bg-panel-2/50 p-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-pass" />
              </span>

              <span className="text-xs font-medium text-text">
                System Online
              </span>
            </div>

            <div className="mt-1.5 pl-4 text-[11px] text-muted">
              {settings?.llmProvider ?? "..."} ·{" "}
              <span className="capitalize">
                {settings?.approvalMode?.replace(/_/g, " ") ?? "..."}
              </span>{" "}
              approval
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg px-2 py-1">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-2">
                Appearance
              </div>
              <div className="text-xs text-muted">
                Theme
              </div>
            </div>

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

      <span className="text-sm font-semibold text-text">
        AI Testing
      </span>
    </div>
  </div>

  <Outlet />
</main>
    </div>
  );
}