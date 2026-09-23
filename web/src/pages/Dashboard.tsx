import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";
import {
  FileText,
  ListChecks,
  TestTube2,
  CheckCircle2,
  LoaderCircle,
  CircleX,
  Bot,
  Clock3,
  GitCommitHorizontal,
  Bug,
  ClipboardList,
  BrainCircuit,
  LayoutPanelTop,
  Code2,
  GitBranch,
  Rocket,
  Sparkles,
  ArrowUpRight,
  Activity,
  TrendingUp,
} from "lucide-react";

type Tone = "purple" | "pink" | "blue" | "green" | "orange" | "red";

const toneStyles: Record<
  Tone,
  {
    icon: string;
    glow: string;
    line: string;
  }
> = {
  purple: {
    icon: "bg-violet-500/10 border-violet-400/20 text-violet-300",
    glow: "hover:border-violet-400/30 hover:shadow-violet-500/5",
    line: "from-violet-500/0 via-violet-400/70 to-violet-500/0",
  },
  pink: {
    icon: "bg-pink-500/10 border-pink-400/20 text-pink-300",
    glow: "hover:border-pink-400/30 hover:shadow-pink-500/5",
    line: "from-pink-500/0 via-pink-400/70 to-pink-500/0",
  },
  blue: {
    icon: "bg-cyan-500/10 border-cyan-400/20 text-cyan-300",
    glow: "hover:border-cyan-400/30 hover:shadow-cyan-500/5",
    line: "from-cyan-500/0 via-cyan-400/70 to-cyan-500/0",
  },
  green: {
    icon: "bg-emerald-500/10 border-emerald-400/20 text-emerald-300",
    glow: "hover:border-emerald-400/30 hover:shadow-emerald-500/5",
    line: "from-emerald-500/0 via-emerald-400/70 to-emerald-500/0",
  },
  orange: {
    icon: "bg-amber-500/10 border-amber-400/20 text-amber-300",
    glow: "hover:border-amber-400/30 hover:shadow-amber-500/5",
    line: "from-amber-500/0 via-amber-400/70 to-amber-500/0",
  },
  red: {
    icon: "bg-rose-500/10 border-rose-400/20 text-rose-300",
    glow: "hover:border-rose-400/30 hover:shadow-rose-500/5",
    line: "from-rose-500/0 via-rose-400/70 to-rose-500/0",
  },
};

function StatCard({
  label,
  value,
  icon,
  tone = "purple",
  featured = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: Tone;
  featured?: boolean;
}) {
  const style = toneStyles[tone];

  return (
    <Card
      className={`
        group relative overflow-hidden
        border-border/70
        bg-panel
        transition-all duration-300
        hover:-translate-y-0.5
        hover:shadow-lg
        ${style.glow}
        ${featured ? "p-5" : "p-4"}
      `}
    >
      {featured && (
        <>
          <div
            className={`pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${style.line} opacity-[0.08] blur-2xl`}
          />

          <div
            className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${style.line} opacity-40`}
          />
        </>
      )}

      <div
        className={`absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r ${style.line} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
      />

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            {label}
          </div>

          <div
            className={`mt-2 font-bold tracking-tight text-text ${
              featured ? "text-3xl" : "text-2xl"
            }`}
          >
            {value}
          </div>

          {featured && (
            <div className="mt-1 text-[11px] text-muted">Current total</div>
          )}
        </div>

        <div
          className={`flex shrink-0 items-center justify-center rounded-xl border ${
            featured ? "h-11 w-11" : "h-10 w-10"
          } ${style.icon}`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-pink-400 shadow-[0_0_10px_rgba(244,114,182,0.8)]" />

        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-text">
          {title}
        </h2>
      </div>

      <p className="mt-1.5 text-xs text-muted">{subtitle}</p>
    </div>
  );
}

function PipelineNode({
  label,
  count,
  index,
  active,
}: {
  label: string;
  count: number;
  index: number;
  active: boolean;
}) {
  const icons = [
    FileText,
    Sparkles,
    ListChecks,
    LayoutPanelTop,
    CheckCircle2,
    Sparkles,
    Code2,
    GitBranch,
    Rocket,
  ];

  const Icon = icons[index];

  return (
    <Link
      to="/requirements"
      className={`
        group relative flex min-w-[90px]
        flex-col items-center rounded-xl
        px-3 py-3 text-center
        transition-all duration-300
        ${
          active
            ? "border border-pink-400/25 bg-gradient-to-b from-pink-500/10 to-violet-500/5 shadow-[0_0_24px_rgba(236,72,153,0.08)]"
            : "border border-transparent hover:border-border hover:bg-panel-2"
        }
      `}
    >
      {active && (
        <span className="absolute -top-1 h-2 w-2 animate-pulse rounded-full bg-pink-400 shadow-[0_0_12px_rgba(244,114,182,0.9)]" />
      )}

      <div
        className={`
          flex h-9 w-9 items-center justify-center rounded-lg
          border transition-transform duration-300
          group-hover:scale-110
          ${
            active
              ? "border-pink-400/25 bg-pink-500/10 text-pink-300"
              : "border-border bg-panel-2 text-muted"
          }
        `}
      >
        {Icon && <Icon className="h-3.5 w-3.5" />}
      </div>

      <div
        className={
          active
            ? "mt-2 text-lg font-bold text-pink-300"
            : "mt-2 text-lg font-bold text-text"
        }
      >
        {count}
      </div>

      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </div>
    </Link>
  );
}

function MetricBar({
  label,
  value,
  max,
  icon,
  tone = "purple",
}: {
  label: string;
  value: number;
  max: number;
  icon: ReactNode;
  tone?: Tone;
}) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const barColors: Record<Tone, string> = {
    purple: "from-violet-500 to-purple-400",
    pink: "from-pink-500 to-fuchsia-400",
    blue: "from-cyan-500 to-blue-400",
    green: "from-emerald-500 to-teal-400",
    orange: "from-amber-500 to-orange-400",
    red: "from-rose-500 to-red-400",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted">{icon}</span>
          <span className="truncate text-xs text-muted">{label}</span>
        </div>

        <span className="text-xs font-semibold text-text">{value}</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-muted/10">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barColors[tone]} transition-all duration-700`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: api.getDashboardSummary,
    refetchInterval: 5000,
  });

  const totalRuns = data?.testRunsTotal ?? 0;
  const passedRuns = data?.testRunsPassed ?? 0;
  const failedRuns = data?.testRunsFailed ?? 0;
  const runningRuns = data?.testRunsInProgress ?? 0;

  const passRate =
    totalRuns > 0 ? Math.round((passedRuns / totalRuns) * 100) : 0;

  const workflowMax = Math.max(
    data?.totalRequirements ?? 0,
    data?.scenariosGenerated ?? 0,
    data?.testsGenerated ?? 0,
    data?.testsApproved ?? 0,
    1
  );

  return (
    <div className="relative min-h-full overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="dashboard-orb dashboard-orb-purple" />
        <div className="dashboard-orb dashboard-orb-pink" />
      </div>

      <div className="relative z-10">
        <PageHeader
          title="Dashboard"
          subtitle="Overview of the entire AI Testing Platform pipeline"
        />

        <div className="space-y-8 p-6 md:p-8">
          {/* WORKSPACE STATUS */}
          <div className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-r from-violet-500/[0.07] via-panel to-pink-500/[0.07] px-5 py-4">
            <div className="pointer-events-none absolute -right-10 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-pink-400/10 blur-3xl" />

            <div className="relative flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-400/20 bg-pink-500/10 text-pink-300">
                  <Sparkles className="h-4 w-4" />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-text">
                    AI Testing Workspace
                  </h3>

                  <p className="text-[11px] text-muted">
                    Pipeline health and agent activity
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/15 bg-emerald-500/[0.06] px-3 py-1.5 md:self-auto">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />

                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                  System online
                </span>
              </div>
            </div>
          </div>

          {/* KPI OVERVIEW */}
          <section>
            <SectionTitle
              title="System Overview"
              subtitle="Key metrics across your AI testing workflow"
            />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Requirements"
                value={data?.totalRequirements ?? 0}
                icon={<FileText className="h-4 w-4" />}
                tone="purple"
                featured
              />

              <StatCard
                label="Scenarios Generated"
                value={data?.scenariosGenerated ?? 0}
                icon={<ListChecks className="h-4 w-4" />}
                tone="blue"
                featured
              />

              <StatCard
                label="Tests Generated"
                value={data?.testsGenerated ?? 0}
                icon={<TestTube2 className="h-4 w-4" />}
                tone="pink"
                featured
              />

              <StatCard
                label="Tests Approved"
                value={data?.testsApproved ?? 0}
                icon={<CheckCircle2 className="h-4 w-4" />}
                tone="green"
                featured
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              <StatCard
                label="In Progress"
                value={data?.requirementsInProgress ?? 0}
                icon={<LoaderCircle className="h-4 w-4" />}
                tone="orange"
              />

              <StatCard
                label="Failed"
                value={data?.requirementsFailed ?? 0}
                icon={<CircleX className="h-4 w-4" />}
                tone={data?.requirementsFailed ? "red" : "purple"}
              />

              <StatCard
                label="Agents Running"
                value={data?.agentJobsRunning ?? 0}
                icon={<Bot className="h-4 w-4" />}
                tone="pink"
              />

              <StatCard
                label="Awaiting Approval"
                value={data?.scenariosAwaitingApproval ?? 0}
                icon={<Clock3 className="h-4 w-4" />}
                tone="orange"
              />

              <StatCard
                label="Git Commits"
                value={data?.testsCommitted ?? 0}
                icon={<GitCommitHorizontal className="h-4 w-4" />}
                tone="green"
              />

              <StatCard
                label="Total Commits"
                value={data?.commitsTotal ?? 0}
                icon={<GitCommitHorizontal className="h-4 w-4" />}
                tone="purple"
              />

              <StatCard
                label="Agent Failures"
                value={data?.agentJobsFailed ?? 0}
                icon={<CircleX className="h-4 w-4" />}
                tone={data?.agentJobsFailed ? "red" : "purple"}
              />
            </div>
          </section>

          {/* ANALYTICS */}
          <section>
            <SectionTitle
              title="Analytics"
              subtitle="Current workflow distribution and quality signals"
            />

            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              {/* Workflow distribution */}
              <Card className="relative overflow-hidden border-border/70 bg-panel p-5">
                <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-purple-500/[0.05] blur-3xl" />

                <div className="relative">
                  <div className="mb-6 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-violet-300" />

                        <h3 className="text-sm font-semibold text-text">
                          Workflow Volume
                        </h3>
                      </div>

                      <p className="mt-1 text-xs text-muted">
                        Current distribution across the testing lifecycle
                      </p>
                    </div>

                    <div className="rounded-lg border border-border bg-panel-2 px-2 py-1 text-[10px] font-medium text-muted">
                      Live
                    </div>
                  </div>

                  <div className="space-y-5">
                    <MetricBar
                      label="Requirements"
                      value={data?.totalRequirements ?? 0}
                      max={workflowMax}
                      icon={<FileText className="h-3.5 w-3.5" />}
                      tone="purple"
                    />

                    <MetricBar
                      label="Scenarios generated"
                      value={data?.scenariosGenerated ?? 0}
                      max={workflowMax}
                      icon={<ListChecks className="h-3.5 w-3.5" />}
                      tone="blue"
                    />

                    <MetricBar
                      label="Tests generated"
                      value={data?.testsGenerated ?? 0}
                      max={workflowMax}
                      icon={<TestTube2 className="h-3.5 w-3.5" />}
                      tone="pink"
                    />

                    <MetricBar
                      label="Tests approved"
                      value={data?.testsApproved ?? 0}
                      max={workflowMax}
                      icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                      tone="green"
                    />
                  </div>
                </div>
              </Card>

              {/* Quality snapshot */}
              <Card className="relative overflow-hidden border-border/70 bg-panel p-5">
                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-pink-500/[0.06] blur-3xl" />

                <div className="relative">
                  <div className="mb-5">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-pink-300" />

                      <h3 className="text-sm font-semibold text-text">
                        Quality Snapshot
                      </h3>
                    </div>

                    <p className="mt-1 text-xs text-muted">
                      Current automated test health
                    </p>
                  </div>

                  <div className="flex items-center gap-6">
                    <div
                      className="relative flex h-32 w-32 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(#ec4899 ${passRate}%, rgba(148,163,184,0.12) ${passRate}% 100%)`,
                      }}
                    >
                      <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full bg-panel">
                        <span className="text-2xl font-bold text-text">
                          {passRate}%
                        </span>

                        <span className="text-[9px] uppercase tracking-wider text-muted">
                          pass rate
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-400" />
                          <span className="text-xs text-muted">Passed</span>
                        </div>

                        <span className="text-sm font-semibold text-text">
                          {passedRuns}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-400" />
                          <span className="text-xs text-muted">Failed</span>
                        </div>

                        <span className="text-sm font-semibold text-text">
                          {failedRuns}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          <span className="text-xs text-muted">Running</span>
                        </div>

                        <span className="text-sm font-semibold text-text">
                          {runningRuns}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-border pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Total test runs</span>
                      <span className="font-semibold text-text">
                        {totalRuns}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Secondary analytics */}
         <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <Card className="border-border/70 bg-panel p-5">
                <div className="mb-5 flex items-center gap-2">
                  <BrainCircuit className="h-4 w-4 text-pink-300" />

                  <div>
                    <h3 className="text-sm font-semibold text-text">
                      Agent Activity
                    </h3>

                    <p className="text-xs text-muted">
                      Current automation workload
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex h-44 flex-col justify-end rounded-xl border border-border bg-panel-2/50 p-3">
                    <div className="flex h-14 items-end gap-1">
                      <div className="h-5 w-full rounded-sm bg-violet-500/40" />
                      <div className="h-9 w-full rounded-sm bg-violet-500/60" />
                      <div className="h-12 w-full rounded-sm bg-violet-500" />
                      <div className="h-7 w-full rounded-sm bg-violet-500/50" />
                      <div className="h-10 w-full rounded-sm bg-violet-500/80" />
                    </div>

                    <div className="mt-3 text-[10px] uppercase tracking-wider text-muted">
                      Running
                    </div>

                    <div className="text-lg font-bold text-text">
                      {data?.agentJobsRunning ?? 0}
                    </div>
                  </div>

                  <div className="flex h-44 flex-col justify-end rounded-xl border border-border bg-panel-2/50 p-3">
                    <div className="flex h-14 items-end gap-1">
                      <div className="h-8 w-full rounded-sm bg-pink-500/40" />
                      <div className="h-12 w-full rounded-sm bg-pink-500/70" />
                      <div className="h-6 w-full rounded-sm bg-pink-500/40" />
                      <div className="h-10 w-full rounded-sm bg-pink-500/60" />
                      <div className="h-4 w-full rounded-sm bg-pink-500/30" />
                    </div>

                    <div className="mt-3 text-[10px] uppercase tracking-wider text-muted">
                      Awaiting
                    </div>

                    <div className="text-lg font-bold text-text">
                      {data?.scenariosAwaitingApproval ?? 0}
                    </div>
                  </div>

                  <div className="flex h-44 flex-col justify-end rounded-xl border border-border bg-panel-2/50 p-3">
                    <div className="flex h-14 items-end gap-1">
                      <div className="h-4 w-full rounded-sm bg-rose-500/30" />
                      <div className="h-7 w-full rounded-sm bg-rose-500/50" />
                      <div className="h-5 w-full rounded-sm bg-rose-500/40" />
                      <div className="h-10 w-full rounded-sm bg-rose-500/70" />
                      <div className="h-3 w-full rounded-sm bg-rose-500/30" />
                    </div>

                    <div className="mt-3 text-[10px] uppercase tracking-wider text-muted">
                      Failures
                    </div>

                    <div className="text-lg font-bold text-text">
                      {data?.agentJobsFailed ?? 0}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-border/70 bg-panel p-5">
                <div className="mb-5 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-300" />

                  <div>
                    <h3 className="text-sm font-semibold text-text">
                      Execution Health
                    </h3>

                    <p className="text-xs text-muted">
                      Test execution overview
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-panel-2/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Passed</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </div>

                    <div className="mt-3 text-2xl font-bold text-text">
                      {passedRuns}
                    </div>

                    <div className="mt-1 text-[10px] text-muted">
                      Successful runs
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-panel-2/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Bugs</span>
                      <Bug className="h-4 w-4 text-pink-400" />
                    </div>

                    <div className="mt-3 text-2xl font-bold text-text">
                      {data?.bugsFound ?? 0}
                    </div>

                    <div className="mt-1 text-[10px] text-muted">
                      Issues detected
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-panel-2/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Running</span>
                      <LoaderCircle className="h-4 w-4 text-amber-400" />
                    </div>

                    <div className="mt-3 text-2xl font-bold text-text">
                      {runningRuns}
                    </div>

                    <div className="mt-1 text-[10px] text-muted">
                      Active executions
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-panel-2/50 p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted">Commits</span>
                      <GitBranch className="h-4 w-4 text-violet-400" />
                    </div>

                    <div className="mt-3 text-2xl font-bold text-text">
                      {data?.commitsTotal ?? 0}
                    </div>

                    <div className="mt-1 text-[10px] text-muted">
                      Repository activity
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* CI/CD */}
          <section>
            <SectionTitle
              title="CI/CD Execution"
              subtitle="Automated execution and quality status"
            />

            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              <Card className="relative overflow-hidden border-border/70 bg-panel p-5">
                <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-purple-500/[0.06] blur-3xl" />

                <div className="relative">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                        Test Execution
                      </div>

                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="text-4xl font-bold tracking-tight text-text">
                          {totalRuns}
                        </span>

                        <span className="text-sm text-muted">total runs</span>
                      </div>
                    </div>

                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 text-purple-400">
                      <TestTube2 className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="text-muted">Pass rate</span>

                      <span className="font-medium text-text">
                        {passRate}%
                      </span>
                    </div>

                    <div className="h-2 overflow-hidden rounded-full bg-muted/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                        style={{ width: `${passRate}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="border-border/70 bg-panel p-5">
                <div className="mb-4">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                    Execution Status
                  </div>

                  <div className="mt-1 text-xs text-muted">
                    Current test-run health
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-panel-2/50 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-pass" />
                      <span className="text-xs text-muted">Passed</span>
                    </div>

                    <div className="mt-2 text-xl font-semibold text-text">
                      {passedRuns}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-panel-2/50 p-3">
                    <div className="flex items-center gap-2">
                      <CircleX className="h-4 w-4 text-fail" />
                      <span className="text-xs text-muted">Failed</span>
                    </div>

                    <div className="mt-2 text-xl font-semibold text-text">
                      {failedRuns}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-panel-2/50 p-3">
                    <div className="flex items-center gap-2">
                      <LoaderCircle className="h-4 w-4 text-warn" />
                      <span className="text-xs text-muted">Running</span>
                    </div>

                    <div className="mt-2 text-xl font-semibold text-text">
                      {runningRuns}
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-panel-2/50 p-3">
                    <div className="flex items-center gap-2">
                      <Bug className="h-4 w-4 text-pink-400" />
                      <span className="text-xs text-muted">Bugs</span>
                    </div>

                    <div className="mt-2 text-xl font-semibold text-text">
                      {data?.bugsFound ?? 0}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {/* PIPELINE */}
          <section>
            <SectionTitle
              title="Testing Pipeline"
              subtitle="Requirement → generation → approval → Git → CI/CD"
            />

            <Card className="relative overflow-hidden border-border/70 bg-panel">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent" />

              <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-purple-500/[0.04] blur-3xl" />

              <div className="relative overflow-x-auto px-5 py-6">
                <div className="flex min-w-[900px] items-center">
                  {data?.pipeline?.map((stage, i) => (
                    <div
                      key={stage.key}
                      className="flex flex-1 items-center"
                    >
                      <PipelineNode
                        label={stage.label}
                        count={stage.count}
                        index={i}
                        active={stage.count > 0}
                      />

                      {i < data.pipeline.length - 1 && (
                        <div className="relative mx-1 flex flex-1 items-center">
                          <div className="h-px w-full bg-border" />

                          <div className="absolute left-0 h-px w-1/2 bg-gradient-to-r from-purple-400/50 to-pink-400/50" />

                          <span className="absolute right-[-3px] flex h-4 w-4 items-center justify-center rounded-full border border-border bg-panel text-[9px] text-muted">
                            →
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </section>

          {/* QUICK ACTIONS */}
          <section>
            <SectionTitle
              title="Quick Access"
              subtitle="Jump directly into your testing workspace"
            />

            <div className="grid gap-3 md:grid-cols-2">
              <Link
                to="/requirements"
                className="group relative overflow-hidden rounded-xl border border-border/70 bg-panel p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-400/30 hover:shadow-lg hover:shadow-purple-500/[0.06]"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-purple-500/[0.06] blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 text-purple-300 transition-transform duration-300 group-hover:scale-105">
                      <FileText className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-text">
                        Requirements
                      </div>

                      <div className="mt-1 text-xs text-muted">
                        Review and manage requirements
                      </div>
                    </div>
                  </div>

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-panel-2 text-muted transition-all duration-300 group-hover:border-purple-400/30 group-hover:bg-purple-500/10 group-hover:text-purple-300">
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-purple-400/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>

              <Link
                to="/agents"
                className="group relative overflow-hidden rounded-xl border border-border/70 bg-panel p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-pink-400/30 hover:shadow-lg hover:shadow-pink-500/[0.06]"
              >
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-pink-500/[0.06] blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-pink-400/20 bg-pink-500/10 text-pink-300 transition-transform duration-300 group-hover:scale-105">
                      <Bot className="h-4 w-4" />
                    </div>

                    <div>
                      <div className="text-sm font-semibold text-text">
                        Agent Activity
                      </div>

                      <div className="mt-1 text-xs text-muted">
                        Monitor active AI agents
                      </div>
                    </div>
                  </div>

                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-panel-2 text-muted transition-all duration-300 group-hover:border-pink-400/30 group-hover:bg-pink-500/10 group-hover:text-pink-300">
                    <ArrowUpRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </div>
                </div>

                <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-pink-400/40 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}