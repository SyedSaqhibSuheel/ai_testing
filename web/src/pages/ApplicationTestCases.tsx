import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, CalendarDays, ChevronRight, FlaskConical, Lightbulb, Play, RotateCw, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  Btn,
  CellLabel,
  type Crumb,
  Chip,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  Kpi,
  KpiGroup,
  LoadingState,
  PageBody,
  PageHeader,
  PageShell,
  PriorityLabel,
  RiskLabel,
  SkeletonRows,
  StatusPill,
  Surface,
  SurfaceHeader,
  TextAction,
  cx,
  tableHeadClass,
  tableRowClass,
} from "@/components/workspace/kit";

const CASE_GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_110px_100px_200px] lg:items-center lg:gap-4";
const RUN_GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_90px_150px_24px] lg:items-center lg:gap-4";

const TRAIL: Crumb[] = ["Test design", { label: "Test case management", to: "/test-case-management" }];

function FailureBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-fail/20 bg-fail/5 p-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-fail">
        <AlertTriangle className="h-3.5 w-3.5" />
        {title}
      </div>
      <div className="mono mt-1.5 whitespace-pre-wrap break-words text-xs text-text">{children}</div>
    </div>
  );
}

export function ApplicationTestCases() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [runningTestFileId, setRunningTestFileId] = useState<string | null>(null);

  const { data: applications, isLoading: applicationsLoading } = useQuery({
    queryKey: ["applications"],
    queryFn: api.listApplications,
  });

  const application = applications?.find((app) => app.id === id);

  const { data: scenarios, isLoading: scenariosLoading, error } = useQuery({
    queryKey: ["scenarios", "application", id],
    queryFn: () => api.listScenarios({ applicationId: id! }),
    enabled: Boolean(id),
  });

  const {
    data: testRuns,
    isLoading: testRunsLoading,
    error: testRunsError,
  } = useQuery({
    queryKey: ["test-runs", "application", id],
    queryFn: () => api.listTestRuns({ applicationId: id! }),
    enabled: Boolean(id),
    // Keeps the Execution History live while any run started here (e.g. by
    // "Save & Run All") is still in flight, instead of freezing on "Running"
    // until the user manually reloads the page.
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "running") ? 2000 : false),
  });

  const {
    data: selectedRunDetails,
    isLoading: selectedRunLoading,
  } = useQuery({
    queryKey: ["test-run", selectedRunId],
    queryFn: () => api.getTestRun(selectedRunId!),
    enabled: Boolean(selectedRunId),
    refetchInterval: (query) => (query.state.data?.run.status === "running" ? 2000 : false),
  });

  const runAll = useMutation({
    mutationFn: () => api.runAllTests(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-runs"] });
    },
  });

  const runsByDate = (testRuns ?? []).reduce<Record<string, typeof testRuns>>(
    (groups, run) => {
      const date = new Date(run.startedAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (!groups[date]) {
        groups[date] = [];
      }

      groups[date]!.push(run);
      return groups;
    },
    {},
  );

  if (applicationsLoading) {
    return (
      <PageShell>
        <PageHeader trail={TRAIL} title="Test Case Management" subtitle="Loading application..." />
        <PageBody>
          <LoadingState />
        </PageBody>
      </PageShell>
    );
  }

  if (!application) {
    return (
      <PageShell>
        <PageHeader trail={TRAIL} title="Application Not Found" subtitle="The selected application could not be found." />
        <PageBody>
          <Link to="/test-case-management" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to applications
          </Link>
        </PageBody>
      </PageShell>
    );
  }

  const passedRuns = testRuns?.filter((r) => r.status === "passed").length ?? 0;
  const failedRuns = testRuns?.filter((r) => r.status === "failed" || r.status === "error").length ?? 0;
  const rerunPending = runningTestFileId === selectedRunDetails?.run.testFileId;

  return (
    <PageShell>
      <PageHeader
        trail={[...TRAIL, application.name]}
        title={application.name}
        subtitle={application.description ?? "Test cases and execution history for this application"}
        actions={
          <div className="flex flex-col items-start gap-1 lg:items-end">
            <Btn variant="primary" icon={runAll.isPending ? RotateCw : Play} iconClassName={runAll.isPending ? "animate-spin" : undefined} onClick={() => runAll.mutate()} disabled={runAll.isPending}>
              {runAll.isPending ? "Running..." : "Save & Run All"}
            </Btn>
            {runAll.isError && <p className="text-xs text-fail">{(runAll.error as Error).message}</p>}
          </div>
        }
      />

      <PageBody>
        <KpiGroup>
          <Kpi label="Test cases" value={scenarios?.length ?? "–"} />
          <Kpi label="Executions" value={testRuns?.length ?? "–"} />
          <Kpi label="Passed" value={testRuns ? passedRuns : "–"} tone="pass" />
          <Kpi label="Failed" value={testRuns ? failedRuns : "–"} tone="fail" />
        </KpiGroup>

        <Surface className="overflow-hidden">
          <SurfaceHeader title="Test Cases" meta={scenarios && <Chip>{scenarios.length}</Chip>} description={`Test cases assigned to ${application.name}.`} />

          {scenariosLoading && <SkeletonRows rows={3} />}
          {error && (
            <div className="p-6">
              <ErrorState>Failed to load test cases.</ErrorState>
            </div>
          )}
          {!scenariosLoading && !error && scenarios?.length === 0 && (
            <EmptyState icon={FlaskConical} title="No test cases yet" description="No test cases have been assigned to this application yet." />
          )}

          {!scenariosLoading && !error && scenarios && scenarios.length > 0 && (
            <>
              <div className={cx(tableHeadClass, CASE_GRID)}>
                <span>Test case</span>
                <span>Priority</span>
                <span>Risk</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-border">
                {scenarios.map((scenario) => (
                  <div key={scenario.id} className={cx(tableRowClass, CASE_GRID)}>
                    <div className="min-w-0">
                      <div className="font-medium text-text">{scenario.title}</div>
                      {scenario.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted">{scenario.description}</p>}
                      <div className="mono mt-1 truncate text-xs text-muted">ID: {scenario.id}</div>
                    </div>
                    <div>
                      <CellLabel at="lg">Priority</CellLabel>
                      <PriorityLabel priority={scenario.priority} />
                    </div>
                    <div>
                      <CellLabel at="lg">Risk</CellLabel>
                      <RiskLabel risk={scenario.riskLevel} />
                    </div>
                    <div>
                      <StatusPill status={scenario.status} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Surface>

        <Surface className="overflow-hidden">
          <SurfaceHeader title="Execution History" description="Test executions organized by date. Select a run to inspect it." />

          {testRunsLoading && <SkeletonRows rows={3} />}
          {testRunsError && (
            <div className="p-6">
              <ErrorState>Failed to load execution history.</ErrorState>
            </div>
          )}
          {!testRunsLoading && !testRunsError && testRuns?.length === 0 && (
            <EmptyState icon={CalendarDays} title="No executions yet" description="No test executions have been recorded for this application yet." />
          )}

          {!testRunsLoading && !testRunsError && Object.keys(runsByDate).length > 0 && (
            <>
              <div className={cx(tableHeadClass, RUN_GRID)}>
                <span>Execution</span>
                <span>Time</span>
                <span>Status</span>
                <span />
              </div>
              {Object.entries(runsByDate).map(([date, runs]) => (
                <div key={date}>
                  <div className="flex items-center justify-between border-b border-border bg-panel-2/40 px-6 py-2 text-xs font-medium text-muted">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {date}
                    </span>
                    <span className="tabular-nums">
                      {runs?.length ?? 0} execution
                      {(runs?.length ?? 0) === 1 ? "" : "s"}
                    </span>
                  </div>
                  <div className="divide-y divide-border border-b border-border last:border-b-0">
                    {runs?.map((run) => {
                      const selected = run.id === selectedRunId;
                      return (
                        <div
                          key={run.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedRunId(run.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedRunId(run.id);
                            }
                          }}
                          className={cx(tableRowClass, RUN_GRID, "relative cursor-pointer focus-visible:outline-none", selected && "bg-primary/5 hover:bg-primary/5")}
                        >
                          {selected && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                          <div className="min-w-0">
                            <div className="font-medium text-text">{run.testCases?.[0]?.testTitle ?? "Execution"}</div>
                            <div className="mono mt-0.5 truncate text-xs text-muted">
                              {run.testCases?.[0] && <>Test Case ID: {run.testCases[0].testCaseId} · </>}Run ID: {run.id}
                            </div>
                          </div>
                          <div className="text-sm text-muted tabular-nums">
                            {new Date(run.startedAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          <div>
                            <StatusPill status={run.status} />
                          </div>
                          <ChevronRight className={cx("hidden h-4 w-4 text-muted lg:block", selected && "text-primary")} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          )}
        </Surface>

        {selectedRunId && (
          <Surface className="ws-rise overflow-hidden">
            <SurfaceHeader
              title="Execution Details"
              description={<span className="mono text-xs">Run ID: {selectedRunId}</span>}
              actions={
                <>
                  <TextAction
                    tone="primary"
                    icon={RotateCw}
                    spinning={rerunPending}
                    onClick={async () => {
                      if (!selectedRunDetails?.run.testFileId) return;

                      setRunningTestFileId(selectedRunDetails.run.testFileId);

                      try {
                        await api.runTestFile(selectedRunDetails.run.testFileId);
                      } finally {
                        setRunningTestFileId(null);
                      }
                    }}
                    disabled={rerunPending}
                  >
                    {rerunPending ? "Running..." : "Run Again"}
                  </TextAction>
                  <IconButton icon={X} label="Close" onClick={() => setSelectedRunId(null)} />
                </>
              }
            />

            {selectedRunLoading && <LoadingState label="Loading execution details..." />}

            {!selectedRunLoading && selectedRunDetails && (
              <>
                <dl className="grid grid-cols-1 gap-6 border-b border-border px-6 py-5 sm:grid-cols-3">
                  <Field label="Status">
                    <StatusPill status={selectedRunDetails.run.status} />
                  </Field>
                  <Field label="Started">{new Date(selectedRunDetails.run.startedAt).toLocaleString("en-IN")}</Field>
                  <Field label="Finished">
                    {selectedRunDetails.run.finishedAt ? new Date(selectedRunDetails.run.finishedAt).toLocaleString("en-IN") : "Still running"}
                  </Field>
                </dl>

                <div className="px-6 pt-5 pb-2 text-xs font-medium uppercase tracking-wider text-muted">Executed Test Cases</div>

                {selectedRunDetails.cases.length === 0 && selectedRunDetails.testCases.length === 0 ? (
                  <p className="px-6 pb-6 text-sm text-muted">No test cases are associated with this execution.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {selectedRunDetails.cases.map((testCase) => (
                      <div key={testCase.id} className="px-6 py-4">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="font-medium text-text">{testCase.title}</div>
                            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                              {testCase.suiteTitle && <span>Suite: {testCase.suiteTitle}</span>}
                              <span className="mono">Test Case ID: {testCase.id}</span>
                              <span className="mono">Duration: {testCase.durationMs} ms</span>
                            </div>
                          </div>
                          <StatusPill status={testCase.status} />
                        </div>

                        {testCase.errorMessage && <FailureBox title="Failure Details">{testCase.errorMessage}</FailureBox>}

                        {(testCase.classification || testCase.suggestedFix) && (
                          <div className="mt-3 flex flex-col gap-2 text-xs">
                            {testCase.classification && (
                              <div className="flex items-center gap-2 text-muted">
                                Classification:
                                <Chip tone={testCase.classification === "REAL_DEFECT" ? "fail" : undefined}>{testCase.classification}</Chip>
                              </div>
                            )}
                            {testCase.suggestedFix && (
                              <div className="flex items-start gap-2 text-text">
                                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" />
                                <span>
                                  <span className="text-muted">Suggested fix: </span>
                                  {testCase.suggestedFix}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {selectedRunDetails.cases.length === 0 &&
                      selectedRunDetails.testCases.map((testCase) => (
                        <div key={testCase.id} className="px-6 py-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="font-medium text-text">{testCase.title}</div>
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
                                <span className="mono">Test Case ID: {testCase.testCaseId}</span>
                                <span>Scenario: {testCase.scenarioTitle}</span>
                              </div>
                            </div>
                            <StatusPill status={selectedRunDetails.run.status} />
                          </div>

                          {selectedRunDetails.run.errorMessage && <FailureBox title="Execution Error">{selectedRunDetails.run.errorMessage}</FailureBox>}

                          <div className="mt-2 text-xs text-muted">
                            This test case was associated with the execution, but Playwright did not record an individual test result.
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </>
            )}
          </Surface>
        )}
      </PageBody>
    </PageShell>
  );
}
