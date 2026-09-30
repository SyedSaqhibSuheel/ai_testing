import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TestFileCard } from "@/pages/RequirementDetail";
import type { PipelineStage, RequirementStatus } from "@/lib/types";

// Requirement statuses where an agent is working in the background.
const BUSY_STATUSES = new Set<RequirementStatus>(["analyzing", "planning", "generating_tests"]);
const PIPELINE_ACTIVE = new Set<PipelineStage>(["approving", "planning", "generating", "committing", "running"]);
const GROUNDED_OR_LATER = new Set(["grounding_in_progress", "grounded_pending_review", "approved_for_generation"]);

interface Step {
  label: string;
  done: boolean;
  active: boolean;
}

function Stepper({ steps }: { steps: Step[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium ${
              s.active
                ? "border-accent/40 bg-accent/15 text-accent"
                : s.done
                  ? "border-pass/30 bg-pass/10 text-pass"
                  : "border-border bg-panel-2 text-muted"
            }`}
          >
            <span aria-hidden>{s.done ? "✓" : s.active ? "…" : i + 1}</span>
            {s.label}
          </span>
          {i < steps.length - 1 && <span className="text-muted-2" aria-hidden>→</span>}
        </li>
      ))}
    </ol>
  );
}

/**
 * Everything for one Code Analysis requirement, inline on the Code Analysis
 * page: what was derived and one click to approve its scenarios and let the
 * platform plan, generate, commit and run the tests. Per-scenario review
 * lives on the full requirement page.
 */
export function RequirementWorkflow({
  requirementId,
  onRetryAnalysis,
  retrying = false,
}: {
  requirementId: string;
  /** Re-runs Code Analysis for rows whose analysis failed (the batch retries failed ones). */
  onRetryAnalysis?: () => void;
  retrying?: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: pipeline } = useQuery({
    queryKey: ["pipeline", requirementId],
    queryFn: () => api.getPipeline(requirementId),
    refetchInterval: (query) => (query.state.data && PIPELINE_ACTIVE.has(query.state.data.stage) ? 2000 : false),
  });
  const pipelineActive = !!pipeline && PIPELINE_ACTIVE.has(pipeline.stage);

  const { data } = useQuery({
    queryKey: ["requirement", requirementId],
    queryFn: () => api.getRequirement(requirementId),
    refetchInterval: (query) => (pipelineActive || BUSY_STATUSES.has(query.state.data?.requirement.status as RequirementStatus) ? 3000 : false),
  });
  const { data: testFiles } = useQuery({
    queryKey: ["test-files", requirementId],
    queryFn: () => api.listTestFiles(requirementId),
    refetchInterval: pipelineActive ? 3000 : false,
  });
  const latestTestFile = testFiles?.find((f) => f.isLatest);
  const { data: runs } = useQuery({
    queryKey: ["test-runs", latestTestFile?.id],
    queryFn: () => api.listTestRuns({ testFileId: latestTestFile!.id }),
    enabled: !!latestTestFile,
    refetchInterval: (query) => (pipelineActive || query.state.data?.some((r) => r.status === "running") ? 2000 : false),
  });

  const analysisFailed = data?.requirement.status === "failed" && data.scenarios.length === 0;
  const { data: agentRuns } = useQuery({
    queryKey: ["agent-runs", requirementId],
    queryFn: () => api.listAgentRuns({ requirementId }),
    enabled: analysisFailed,
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["pipeline", requirementId] });
    queryClient.invalidateQueries({ queryKey: ["requirement", requirementId] });
    queryClient.invalidateQueries({ queryKey: ["test-files", requirementId] });
    queryClient.invalidateQueries({ queryKey: ["test-runs"] });
    queryClient.invalidateQueries({ queryKey: ["code-modules"] });
    queryClient.invalidateQueries({ queryKey: ["code-features"] });
  };
  const start = useMutation({ mutationFn: (scenarioIds: string[]) => api.runPipeline(requirementId, scenarioIds), onSuccess: refreshAll });
  const rerun = useMutation({ mutationFn: (fileId: string) => api.runTestFile(fileId), onSuccess: refreshAll });

  if (!data) return <div className="border-t border-border p-4 text-sm text-muted">Loading...</div>;
  const { requirement, scenarios } = data;
  const proposed = scenarios.filter((s) => s.status === "ai_proposed");
  const hasApprovedWork = scenarios.some((s) => s.status === "approved" || GROUNDED_OR_LATER.has(s.status));
  const committed = latestTestFile?.status === "committed";
  const latestRun = runs?.[0];
  const busy = pipelineActive || BUSY_STATUSES.has(requirement.status) || latestRun?.status === "running";

  const stage = pipelineActive ? pipeline!.stage : null;
  const steps: Step[] = [
    { label: "Scenarios approved", done: hasApprovedWork || !!latestTestFile, active: stage === "approving" },
    { label: "Planned", done: scenarios.some((s) => s.groundedPlan) || !!latestTestFile, active: stage === "planning" || requirement.status === "planning" },
    { label: "Tests generated", done: !!latestTestFile, active: stage === "generating" || requirement.status === "generating_tests" },
    { label: "Committed", done: committed, active: stage === "committing" },
    { label: "Run", done: !!latestRun && latestRun.status !== "running", active: stage === "running" || latestRun?.status === "running" },
  ];

  let primary: { label: string; hint: string; onClick: () => void; disabled?: boolean } | null = null;
  if (requirement.status === "analyzing") {
    primary = null;
  } else if (analysisFailed) {
    primary = onRetryAnalysis
      ? {
          label: retrying ? "Retrying..." : "Retry analysis",
          hint: "The AI's answer for this analysis couldn't be used. Runs the analysis again - nothing needs to be typed.",
          onClick: onRetryAnalysis,
          disabled: retrying,
        }
      : null;
  } else if (proposed.length > 0) {
    primary = null;
  } else if (committed) {
    primary = { label: "Run tests again", hint: "Re-runs the committed test as-is - nothing is regenerated.", onClick: () => rerun.mutate(latestTestFile!.id) };
  } else if (hasApprovedWork || latestTestFile) {
    primary = {
      label: requirement.status === "failed" || pipeline?.stage === "failed" ? "Retry pipeline" : "Continue pipeline",
      hint: "Picks up from where this requirement is: plan, generate, commit and run whatever hasn't been done yet.",
      onClick: () => start.mutate([]),
    };
  }

  const analysisError = analysisFailed ? agentRuns?.find((r) => r.status === "failed")?.errorMessage : undefined;
  const error =
    pipeline?.stage === "failed" ? pipeline.error : (((start.error ?? rerun.error) as Error | null)?.message ?? (analysisError ? `Analysis failed: ${analysisError}` : undefined));

  return (
    <div className="space-y-4 border-t border-border bg-panel-2/40 p-4">
      <Card className="p-4 space-y-3">
        <div className="flex justify-end">
          <Link to={`/requirements/${requirementId}`} className="text-xs text-accent hover:underline">
            Open full requirement
          </Link>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Stepper steps={steps} />
          <StatusBadge status={requirement.status} />
        </div>
        {pipelineActive && <p className="text-sm text-accent">{pipeline!.message}...</p>}
        {!pipelineActive && pipeline?.stage === "done" && latestRun && (
          <p className="text-sm">
            Last run: <StatusBadge status={latestRun.status} />
            {latestRun.totalTests != null && (
              <span className="ml-2 text-muted">
                {latestRun.passedCount}/{latestRun.totalTests} passed
              </span>
            )}
          </p>
        )}
        {error && <p className="text-xs text-fail break-words">{error}</p>}
        {primary && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button onClick={primary.onClick} disabled={busy || start.isPending || rerun.isPending || primary.disabled} className="shrink-0">
              {busy ? "Working..." : primary.label}
            </Button>
            <span className="text-xs text-muted">{primary.hint}</span>
          </div>
        )}
        {requirement.status === "analyzing" && <p className="text-sm text-muted">Deriving scenarios from the source code...</p>}
      </Card>

      {latestTestFile && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Generated Playwright test</h3>
          <TestFileCard file={latestTestFile} requirementId={requirementId} />
        </div>
      )}
    </div>
  );
}
