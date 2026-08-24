import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "pass" | "fail" | "warn" }) {
  const toneClass = tone === "pass" ? "text-pass" : tone === "fail" ? "text-fail" : tone === "warn" ? "text-warn" : "text-text";
  return (
    <Card className="p-4">
      <div className={`text-2xl font-bold tracking-tight ${toneClass}`}>{value}</div>
      <div className="text-xs text-muted uppercase tracking-wide mt-1.5">{label}</div>
    </Card>
  );
}

export function Dashboard() {
  const { data } = useQuery({ queryKey: ["dashboard-summary"], queryFn: api.getDashboardSummary, refetchInterval: 5000 });

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of the entire AI Testing Platform pipeline" />
      <div className="p-8 space-y-8">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">System status</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total requirements" value={data?.totalRequirements ?? 0} />
            <StatCard label="In progress" value={data?.requirementsInProgress ?? 0} tone="warn" />
            <StatCard label="Failed" value={data?.requirementsFailed ?? 0} tone={data?.requirementsFailed ? "fail" : undefined} />
            <StatCard label="Agent jobs running" value={data?.agentJobsRunning ?? 0} tone="warn" />
            <StatCard label="Scenarios generated" value={data?.scenariosGenerated ?? 0} />
            <StatCard label="Scenarios awaiting approval" value={data?.scenariosAwaitingApproval ?? 0} tone="warn" />
            <StatCard label="Tests generated" value={data?.testsGenerated ?? 0} />
            <StatCard label="Tests approved" value={data?.testsApproved ?? 0} tone="pass" />
            <StatCard label="Tests committed to Git" value={data?.testsCommitted ?? 0} tone="pass" />
            <StatCard label="Commits total" value={data?.commitsTotal ?? 0} />
            <StatCard label="Agent jobs failed" value={data?.agentJobsFailed ?? 0} tone={data?.agentJobsFailed ? "fail" : undefined} />
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Pipeline</h2>
          <Card className="p-5 overflow-x-auto">
            <div className="flex items-stretch gap-1 min-w-max">
              {data?.pipeline.map((stage, i) => (
                <div key={stage.key} className="flex items-stretch">
                  <Link
                    to="/requirements"
                    className="flex flex-col items-center justify-center gap-1.5 px-4 py-3 rounded-md hover:bg-panel-2 transition-colors min-w-[110px] text-center"
                  >
                    <div className="text-xl font-bold">{stage.count}</div>
                    <div className="text-[11px] text-muted whitespace-nowrap">{stage.label}</div>
                  </Link>
                  {i < data.pipeline.length - 1 && <div className="flex items-center text-muted px-1">&rarr;</div>}
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex gap-3">
          <Link to="/requirements" className="text-sm text-accent hover:underline">
            View all requirements &rarr;
          </Link>
          <Link to="/agents" className="text-sm text-accent hover:underline">
            View agent activity &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
