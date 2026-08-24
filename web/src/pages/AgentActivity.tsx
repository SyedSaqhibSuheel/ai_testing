import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import type { AgentType } from "@/lib/types";

const AGENT_LABELS: Record<AgentType, string> = {
  intelligence: "AI Requirement / Test-Intent Agent",
  planner: "Playwright Planner",
  generator: "Playwright Generator",
};

export function AgentActivity() {
  const [filter, setFilter] = useState<AgentType | "all">("all");
  const { data } = useQuery({
    queryKey: ["agent-runs", filter],
    queryFn: () => api.listAgentRuns(filter === "all" ? undefined : { agentType: filter }),
    refetchInterval: 4000,
  });

  return (
    <div>
      <PageHeader title="Agent Activity" subtitle="What every AI agent is doing, right now and historically" />
      <div className="p-8 space-y-4">
        <div className="flex gap-2">
          {(["all", "intelligence", "planner", "generator"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
                filter === t ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"
              }`}
            >
              {t === "all" ? "All agents" : t}
            </button>
          ))}
        </div>

        <Card className="divide-y divide-border">
          {data?.map((run) => (
            <div key={run.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{AGENT_LABELS[run.agentType]}</div>
                <StatusBadge status={run.status} />
              </div>
              <div className="text-xs text-muted mt-1">
                <Link to={`/requirements/${run.requirementId}`} className="hover:text-accent">
                  Requirement #{run.requirementId.slice(0, 8)}
                </Link>
                {" · "}
                {run.currentTask}
                {" · started "}
                {new Date(run.startedAt).toLocaleTimeString()}
                {run.finishedAt && ` · finished ${new Date(run.finishedAt).toLocaleTimeString()}`}
                {run.retryCount > 0 && ` · ${run.retryCount} retries`}
              </div>
              {run.errorMessage && <div className="text-xs text-fail mt-1.5">{run.errorMessage}</div>}
            </div>
          ))}
          {data?.length === 0 && <div className="p-6 text-sm text-muted text-center">No agent activity yet.</div>}
        </Card>
      </div>
    </div>
  );
}
