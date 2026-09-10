import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ModeToggle } from "@/components/theme/ModeToggle";
import {
  LayoutDashboard,
  FileText,
  ListChecks,
  Code2,
  GitBranch,
  Activity,
  Settings as SettingsIcon,
  Zap,
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

export function LayoutModern() {
  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  return (
    <div className="flex h-screen bg-bg text-text">
      {/* Sidebar */}
      <aside className="w-72 border-r border-border flex flex-col shrink-0 bg-panel backdrop-blur-xl">
        {/* Header */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-600 flex items-center justify-center shadow-lg">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-text">AI Testing</h1>
            <p className="text-xs text-muted">Platform</p>
          </div>
          <ModeToggle />
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <p className="text-xs font-semibold uppercase text-muted-2 px-2 mb-3 tracking-wider">
            Main
          </p>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `
                  flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium
                  transition-all duration-200 group
                  ${
                    isActive
                      ? "bg-accent/15 text-accent border border-accent/30 shadow-lg shadow-accent/10"
                      : "text-muted hover:text-text hover:bg-panel-2"
                  }
                `
              }
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span>{item.label}</span>
              {item.to === "/" && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500" />
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer Status */}
        <div className="p-4 border-t border-border space-y-3">
          <div className="bg-panel-2 backdrop-blur rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-text font-medium">
                {settings?.llmProvider ?? "Loading"}
              </span>
            </div>
            <div className="text-xs text-muted capitalize">
              {settings?.approvalMode?.replace(/_/g, " ") ?? "Loading"} approval
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-bg">
        <Outlet />
      </main>
    </div>
  );
}
