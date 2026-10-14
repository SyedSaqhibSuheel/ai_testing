import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, BrainCircuit, ChevronDown, Layers, Map as MapIcon, ScanSearch, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import {
  CellLabel,
  EmptyState,
  PageBody,
  PageHeader,
  PageShell,
  SkeletonRows,
  Surface,
  Tabs,
  TableFooter,
  cx,
  elapsed,
  tableHeadClass,
  tableRowClass,
} from "@/components/workspace/kit";
import type { AgentRun, AgentType } from "@/lib/types";

const AGENT_LABELS: Record<AgentType, string> = {
  intelligence: "AI Requirement / Test-Intent Agent",
  planner: "Playwright Planner",
  generator: "Playwright Generator",
  code_analysis: "Code Analysis Agent",
};

const AGENT_ICONS: Record<AgentType, LucideIcon> = {
  intelligence: BrainCircuit,
  code_analysis: ScanSearch,
  planner: MapIcon,
  generator: Wand2,
};

const AGENT_TILE: Record<AgentType, string> = {
  intelligence: "bg-violet-500/10 text-violet-500",
  code_analysis: "bg-sky-500/10 text-sky-500",
  planner: "bg-amber-500/10 text-amber-500",
  generator: "bg-emerald-500/10 text-emerald-500",
};

const FILTERS: { value: AgentType | "all"; label: string; icon: LucideIcon }[] = [
  { value: "all", label: "All agents", icon: Layers },
  { value: "intelligence", label: "Intelligence", icon: BrainCircuit },
  { value: "code_analysis", label: "Code analysis", icon: ScanSearch },
  { value: "planner", label: "Planner", icon: MapIcon },
  { value: "generator", label: "Generator", icon: Wand2 },
];

const GRID = "xl:grid xl:grid-cols-[260px_minmax(0,1fr)_150px_120px_90px] xl:items-center xl:gap-4";

function RunRow({ run }: { run: AgentRun }) {
  const [errorOpen, setErrorOpen] = useState(false);
  const Icon = AGENT_ICONS[run.agentType] ?? Activity;
  const duration = elapsed(run.startedAt, run.finishedAt);

  return (
    <div className="relative">
      {run.status === "running" && <div className="ws-indeterminate" />}
      <div className={cx(tableRowClass, GRID)}>
        <div className="flex min-w-0 items-center gap-3">
          <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", AGENT_TILE[run.agentType] ?? "bg-panel-2 text-muted")}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="truncate text-sm font-medium text-text" title={AGENT_LABELS[run.agentType] ?? run.agentType}>
            {AGENT_LABELS[run.agentType] ?? run.agentType}
          </span>
        </div>

        <div className="min-w-0 text-sm text-muted xl:truncate" title={run.currentTask}>
          {run.currentTask}
          {run.retryCount > 0 && <span className="ml-2 text-xs text-warn">· {run.retryCount} retries</span>}
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 xl:contents">
          <div>
            <Link to={`/requirements/${run.requirementId}`} className="mono text-sm text-text transition-colors hover:text-primary">
              #{run.requirementId.slice(0, 8)}
            </Link>
          </div>
          <div className="text-sm text-muted tabular-nums" title={run.finishedAt ? `finished ${new Date(run.finishedAt).toLocaleTimeString()}` : undefined}>
            <CellLabel>Started</CellLabel>
            {new Date(run.startedAt).toLocaleTimeString()}
          </div>
          <div className="text-sm text-muted tabular-nums">
            <CellLabel>Duration</CellLabel>
            {duration ?? "–"}
          </div>
        </div>
      </div>

      {run.errorMessage && (
        <div className="px-6 pb-4 xl:pl-[68px]">
          <div className="overflow-hidden rounded-lg border border-fail/20 bg-fail/5">
            <button
              type="button"
              onClick={() => setErrorOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-fail transition-colors hover:bg-fail/5"
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className={cx("min-w-0 flex-1", !errorOpen && "truncate")}>{errorOpen ? "Error details" : run.errorMessage}</span>
              <span className="shrink-0 font-medium">{errorOpen ? "Hide" : "Show details"}</span>
              <ChevronDown className={cx("h-3.5 w-3.5 shrink-0 transition-transform", errorOpen && "rotate-180")} />
            </button>
            {errorOpen && (
              <pre className="mono max-h-64 overflow-auto whitespace-pre-wrap break-words border-t border-fail/20 px-3 py-2.5 text-xs leading-relaxed text-fail">
                {run.errorMessage}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentActivity() {
  const [filter, setFilter] = useState<AgentType | "all">("all");
  const { data, isLoading } = useQuery({
    queryKey: ["agent-runs", filter],
    queryFn: () => api.listAgentRuns(filter === "all" ? undefined : { agentType: filter }),
    refetchInterval: 4000,
  });

  return (
    <PageShell>
      <PageHeader trail={["Execution", "Agent activity"]} live="Auto-refreshes every 4 seconds" title="Agent Activity" subtitle="What every AI agent is doing, right now and historically" />

      <PageBody>
        <Surface className="overflow-hidden">
          <div className="border-b border-border px-6 pt-4">
            <Tabs value={filter} onChange={setFilter} options={FILTERS} />
          </div>

          <div className={cx(tableHeadClass, GRID)}>
            <span>Agent</span>
            <span>Task</span>
            <span>Requirement</span>
            <span>Started</span>
            <span>Duration</span>
          </div>

          {isLoading && <SkeletonRows rows={5} />}
          <div className="divide-y divide-border">
            {data?.map((run) => (
              <RunRow key={run.id} run={run} />
            ))}
          </div>
          {data?.length === 0 && <EmptyState icon={Activity} title="No agent activity yet" description="Agent runs will stream in here as requirements move through the pipeline." />}
          {data && data.length > 0 && (
            <TableFooter
              left={`${data.length} runs · ${data.filter((r) => r.status === "running" || r.status === "queued").length} active`}
              right={`${data.filter((r) => r.status === "failed").length} failed`}
            />
          )}
        </Surface>
      </PageBody>
    </PageShell>
  );
}
