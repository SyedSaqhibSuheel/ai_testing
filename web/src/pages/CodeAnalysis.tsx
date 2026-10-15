import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { RequirementWorkflow } from "@/components/RequirementWorkflow";
import type { RequirementStatus } from "@/lib/types";

/** One row of the list - a screen/component, or a behaviour spanning several of them. */
interface SourceRow {
  key: string;
  name: string;
  detail: string;
  requirementId: string | null;
  requirementStatus: RequirementStatus | null;
  /** Its analysis batch is running right now, so "not analyzed" is about to change. */
  analyzing?: boolean;
}

const ACTIONABLE = new Set<RequirementStatus>(["awaiting_scenario_approval", "awaiting_plan_approval", "awaiting_test_approval"]);

export function CodeAnalysis() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: active } = useQuery({ queryKey: ["active-application"], queryFn: api.getActiveApplication });
  const appName = active?.application?.name ?? "the active application";
  const { data } = useQuery({
    queryKey: ["code-modules"],
    queryFn: api.listCodeModules,
    refetchInterval: 4000,
  });
  const { data: featureData } = useQuery({
    queryKey: ["code-features"],
    queryFn: api.listCodeFeatures,
    refetchInterval: 4000,
  });

  // Screens/components and the cross-cutting behaviours are analyzed by the
  // same click; the feature batch waits for the module batch server-side.
  const run = useMutation({
    mutationFn: async (force: boolean) => {
      await api.runCodeAnalysis(force);
      await api.runCodeFeatures(force);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["code-modules"] });
      queryClient.invalidateQueries({ queryKey: ["code-features"] });
    },
  });

  // The cross-cutting behaviours (Theme, Action Buttons, Status, Navigation)
  // are analyzed automatically the first time the page sees one that has
  // never been analyzed - no click needed. Only ones with no requirement at
  // all qualify, so a failed one isn't retried on every visit (use
  // "Analyze remaining modules" for that), and it fires once per page load.
  const autoStarted = useRef(false);
  const autoAnalyze = useMutation({
    mutationFn: () => api.runCodeFeatures(false),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["code-features"] }),
  });
  useEffect(() => {
    if (autoStarted.current || !featureData || featureData.running) return;
    if (featureData.features.some((f) => f.files.length > 0 && !f.requirementId)) {
      autoStarted.current = true;
      autoAnalyze.mutate();
    }
  }, [featureData, autoAnalyze]);

  const runAll = useMutation({
    mutationFn: () => api.runAllTests(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-runs"] });
    },
  });

  // Full auto: one click analyzes the whole app, then plans, generates,
  // commits and runs every requirement. Only in Fully Automatic mode - the
  // other modes keep their human gates, so the button explains instead.
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const fullyAutomatic = settings?.approvalMode === "fully_automatic";
  const { data: autoRun } = useQuery({
    queryKey: ["auto-run"],
    queryFn: api.getAutoRun,
    refetchInterval: (query) => (query.state.data && (query.state.data.stage === "analyzing" || query.state.data.stage === "testing") ? 3000 : false),
  });
  const autoRunActive = !!autoRun && (autoRun.stage === "analyzing" || autoRun.stage === "testing");
  const startAutoRun = useMutation({
    mutationFn: (force: boolean) => api.startAutoRun(force),
    onSuccess: (state) => {
      queryClient.setQueryData(["auto-run"], state);
      queryClient.invalidateQueries({ queryKey: ["code-modules"] });
      queryClient.invalidateQueries({ queryKey: ["code-features"] });
    },
  });
  // Refresh rows and test runs as the auto run moves from one requirement to the next.
  useEffect(() => {
    if (!autoRun) return;
    queryClient.invalidateQueries({ queryKey: ["requirement"] });
    queryClient.invalidateQueries({ queryKey: ["test-runs"] });
  }, [autoRun?.completed, autoRun?.stage, queryClient]);

  const modules = data?.modules ?? [];
  const features = (featureData?.features ?? []).filter((f) => f.files.length > 0);
  const featureNames = new Set(features.map((f) => f.name));
  // Hand-added code_analysis requirements; a feature's own requirement is shown on the feature row instead.
  const added = (data?.added ?? []).filter((r) => !featureNames.has(r.name));
  const isAnalyzed = (r: { requirementId: string | null; requirementStatus: RequirementStatus | null }) => !!r.requirementId && r.requirementStatus !== "failed";
  const analyzedCount = modules.filter(isAnalyzed).length + features.filter(isAnalyzed).length;
  const totalCount = modules.length + features.length;
  const running = (data?.running ?? false) || (featureData?.running ?? false) || autoRunActive;

  const rows: SourceRow[] = [
    ...modules.map((m) => ({
      key: `module:${m.name}`,
      name: m.name,
      detail: `${m.relativePath} · ${m.testIdCount} interactive element${m.testIdCount === 1 ? "" : "s"} found`,
      requirementId: m.requirementId,
      requirementStatus: m.requirementStatus,
    })),
    ...features.map((f) => ({
      key: `feature:${f.name}`,
      name: f.title,
      detail: `Spans ${f.files.length} source file${f.files.length === 1 ? "" : "s"}: ${f.files.join(", ")}`,
      requirementId: f.requirementId,
      requirementStatus: f.requirementStatus,
      analyzing: featureData?.running || autoAnalyze.isPending,
    })),
    ...added.map((r) => ({
      key: `added:${r.requirementId}`,
      name: r.name,
      detail: "Added requirement · spans multiple components",
      requirementId: r.requirementId,
      requirementStatus: r.requirementStatus,
    })),
  ];
  const needsReview = rows.filter((r) => r.requirementStatus && ACTIONABLE.has(r.requirementStatus)).length;

  return (
    <div>
      <PageHeader
        title="Code Analysis"
        subtitle={`No requirement text needed - scan ${appName}'s own source code and let AI infer what to test`}
      />
      <div className="p-8 space-y-6">
        {active && !active.hasSourceAccess ? (
          <Card className="p-5 text-sm text-muted">
            {appName} has no source directories configured, so there's nothing to scan here. Code Analysis is optional -
            add a requirement manually (or run the Planner with live browser exploration) to test it anyway, or set its
            source directories on the <Link to="/applications" className="text-accent hover:underline">Applications</Link> page.
          </Card>
        ) : (
        <Card className="p-5">
          {(active?.missingSourceDirs?.length ?? 0) > 0 && (
            <p className="text-xs text-fail mb-4">
              Some source folders configured for {appName} don't exist, so they're skipped:{" "}
              {active!.missingSourceDirs!.map((d) => d.path).join(", ")}. Fix them on the{" "}
              <Link to="/applications" className="text-accent hover:underline">Applications</Link> page.
            </p>
          )}
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-sm font-medium">
                {totalCount === 0 ? "Scanning source..." : `${analyzedCount} / ${totalCount} ${appName} screens & behaviours analyzed`}
              </div>
              <p className="text-xs text-muted mt-1 max-w-xl">
                Reads every real screen/component in {appName} (excludes the generic UI kit and demo wrappers), plus the
                behaviours that span several of them - theme (dark/light mode), action buttons, statuses and navigation -
                reverse-engineers each one straight from the code, and
                proposes draft test scenarios. Open any analyzed row to approve its scenarios and generate and run its tests.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                onClick={() => startAutoRun.mutate(false)}
                disabled={!fullyAutomatic || running || startAutoRun.isPending}
                title={
                  fullyAutomatic
                    ? "Analyze every screen, then generate, commit and run the tests for all of them"
                    : 'Needs approval mode "Fully Automatic" (Settings). In other modes, open a row to approve and run it.'
                }
              >
                {autoRunActive ? "Full auto running..." : "Run full auto"}
              </Button>
              <Button
                variant="secondary"
                onClick={() => run.mutate(true)}
                disabled={running || run.isPending}
                title="Re-analyze every module and behaviour, including ones already analyzed"
              >
                Re-analyze all
              </Button>
              <Button onClick={() => run.mutate(false)} disabled={running || run.isPending || analyzedCount === totalCount}>
                {running ? "Analyzing..." : "Analyze remaining modules"}
              </Button>
              <Button onClick={() => runAll.mutate()} disabled={runAll.isPending}>
                {runAll.isPending ? "Running..." : "Save & Run All"}
              </Button>
            </div>
          </div>
          {!fullyAutomatic && settings && (
            <p className="text-xs text-muted mt-3">
              Full auto is off because approval mode is "{settings.approvalMode.replace(/_/g, " ")}". Switch to Fully Automatic in{" "}
              <Link to="/settings" className="text-accent hover:underline">Settings</Link> to analyze, generate, commit and run everything with one click.
            </p>
          )}
          {startAutoRun.isError && <p className="text-xs text-fail mt-3">{(startAutoRun.error as Error).message}</p>}
          {autoRun && (
            <div className="mt-4 rounded-md border border-border bg-panel-2 p-3 text-xs space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className={autoRun.stage === "failed" ? "text-fail" : autoRunActive ? "text-accent" : "text-text"}>{autoRun.message}</span>
                {autoRun.total > 0 && (
                  <span className="shrink-0 text-muted">
                    {autoRun.completed} / {autoRun.total} done
                    {autoRun.failed ? ` · ${autoRun.failed} could not finish` : ""}
                  </span>
                )}
              </div>
              {autoRun.total > 0 && (
                <div className="h-1.5 rounded-full bg-border overflow-hidden">
                  <div className="h-full bg-accent transition-all" style={{ width: `${Math.round((autoRun.completed / autoRun.total) * 100)}%` }} />
                </div>
              )}
              {autoRun.error && <p className="text-fail">{autoRun.error}</p>}
              {autoRun.failures.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-muted">Requirements that could not finish ({autoRun.failures.length})</summary>
                  <ul className="mt-2 space-y-1">
                    {autoRun.failures.map((f) => (
                      <li key={f.requirementId}>
                        <Link to={`/requirements/${f.requirementId}`} className="text-accent hover:underline">{f.title}</Link>
                        <span className="text-muted"> - {f.error}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {autoRun.stage === "done" && autoRun.applicationId && (
                <p>
                  Reports are under{" "}
                  <Link to={`/test-case-management/${autoRun.applicationId}`} className="text-accent hover:underline">Test Case Management</Link>.
                </p>
              )}
            </div>
          )}
          {run.isError && <p className="text-xs text-fail mt-3">{(run.error as Error).message}</p>}
          {autoAnalyze.isError && <p className="text-xs text-fail mt-3">{(autoAnalyze.error as Error).message}</p>}
          {runAll.isError && <p className="text-xs text-fail mt-3">{(runAll.error as Error).message}</p>}
          {running && (
            <p className="text-xs text-muted mt-3">
              Running in the background - each module becomes a requirement below as soon as it's analyzed. Safe to navigate away.
            </p>
          )}
        </Card>
        )}

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            Discovered screens/components {rows.length ? `(${rows.length}${needsReview ? ` · ${needsReview} awaiting review` : ""})` : ""}
          </h2>
          <Card className="divide-y divide-border overflow-hidden">
            {rows.length === 0 && <div className="p-6 text-sm text-muted text-center">No screens found by the source scanner yet.</div>}
            {rows.map((r) => {
              const isOpen = !!r.requirementId && expanded === r.key;
              return (
                <div key={r.key}>
                  <button
                    type="button"
                    onClick={() => r.requirementId && setExpanded(isOpen ? null : r.key)}
                    disabled={!r.requirementId}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-panel-2 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-2">
                        {r.name}
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted bg-panel-2 rounded px-1.5 py-0.5">
                          Source code
                        </span>
                      </div>
                      <div className="text-xs text-muted mt-1 truncate">{r.detail}</div>
                    </div>
                    <span className="shrink-0 flex items-center gap-3">
                      {r.requirementId ? (
                        <StatusBadge status={r.requirementStatus ?? "submitted"} />
                      ) : (
                        <span className={`text-xs ${r.analyzing ? "text-accent" : "text-muted-2"}`}>{r.analyzing ? "Analyzing..." : "Not yet analyzed"}</span>
                      )}
                      {r.requirementId && <span className="w-8 text-right text-xs text-muted">{isOpen ? "Hide" : "Open"}</span>}
                    </span>
                  </button>
                  {isOpen && (
                    <RequirementWorkflow
                      requirementId={r.requirementId!}
                      // Same as "Analyze remaining modules": both batches skip analyzed rows and retry failed ones.
                      onRetryAnalysis={() => run.mutate(false)}
                      retrying={running || run.isPending}
                    />
                  )}
                </div>
              );
            })}
          </Card>
        </div>
      </div>
    </div>
  );
}
