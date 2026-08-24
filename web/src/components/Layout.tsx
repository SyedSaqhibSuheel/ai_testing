import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  Code2,
  GitBranch,
  Activity,
  Settings as SettingsIcon,
} from "lucide-react";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/requirements", label: "Requirements", icon: FileText },
  { to: "/scenarios", label: "Scenarios", icon: ListChecks },
  { to: "/test-files", label: "Generated Tests", icon: Code2 },
  { to: "/git", label: "Git", icon: GitBranch },
  { to: "/agents", label: "Agent Activity", icon: Activity },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Layout() {
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });

  return (
    <div className="flex h-screen bg-bg text-text">
      <aside className="w-60 border-r border-border flex flex-col shrink-0">
        <div className="h-14 flex items-center gap-2.5 px-4 border-b border-border">
          <span className="w-6 h-6 rounded-md bg-gradient-to-br from-accent to-purple-400 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
          <span className="font-semibold text-sm">AI Testing Platform</span>
        </div>

        <nav className="flex-1 py-3 space-y-0.5 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2.5 py-2 rounded-md text-sm transition-colors ${
                  isActive ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2 hover:text-text"
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border text-xs text-muted space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pass" />
            {settings?.llmProvider ?? "..."}
          </div>
          <div className="capitalize">{settings?.approvalMode?.replace(/_/g, " ") ?? "..."} approval</div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
