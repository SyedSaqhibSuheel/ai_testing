import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import type { Scenario, TestFile, TestRunCase } from "@/lib/types";

function Section({ title, children, actions }: { title: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
        {actions}
      </div>
      {children}
    </div>
  );
}

function ScenarioCard({ scenario, requirementId }: { scenario: Scenario; requirementId: string }) {
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [reason, setReason] = useState("");
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["requirement", requirementId] });
    queryClient.invalidateQueries({ queryKey: ["scenarios"] });
  };

  const approve = useMutation({ mutationFn: () => api.approveScenario(scenario.id), onSuccess: invalidate });
  const reject = useMutation({
    mutationFn: () => api.rejectScenario(scenario.id, reason),
    onSuccess: () => {
      setRejectOpen(false);
      setReason("");
      invalidate();
    },
  });
  const regenerate = useMutation({
    mutationFn: () => api.regenerateScenario(scenario.id, reason || undefined),
    onSuccess: () => {
      setRegenOpen(false);
      setReason("");
      invalidate();
    },
  });
  const remove = useMutation({ mutationFn: () => api.deleteScenario(scenario.id), onSuccess: invalidate });

  const canApprove = scenario.status === "ai_proposed" || scenario.status === "grounded_pending_review";

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">{scenario.title}</div>
          <div className="text-xs text-muted mt-1">{scenario.description}</div>
        </div>
        <StatusBadge status={scenario.status} />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          Priority: <span className="text-text">{scenario.priority}</span>
        </span>
        <span>
          Risk: <span className="text-text">{scenario.riskLevel}</span>
        </span>
        {scenario.aiConfidence != null && (
          <span>
            AI confidence: <span className="text-text">{Math.round(scenario.aiConfidence * 100)}%</span>
          </span>
        )}
        <span>
          Source: <span className="text-text">{scenario.sourceType === "user_added" ? "Human-authored" : "AI-generated"}</span>
        </span>
      </div>

      {scenario.preconditions.length > 0 && (
        <div className="text-xs">
          <span className="text-muted">Preconditions: </span>
          {scenario.preconditions.join("; ")}
        </div>
      )}

      {scenario.groundedPlan ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-accent">Grounded plan ({scenario.groundedPlan.steps.length} steps)</summary>
          <ol className="mt-2 space-y-1 pl-4 list-decimal">
            {scenario.groundedPlan.steps.map((s) => (
              <li key={s.index}>
                {s.action}
                {s.targetTestId && <span className="mono text-muted"> [{s.targetTestId}]</span>}
              </li>
            ))}
          </ol>
        </details>
      ) : (
        <div className="text-xs text-muted">
          Draft steps: {scenario.draftSteps.join(" -> ")}
        </div>
      )}

      {scenario.rejectedReason && <div className="text-xs text-fail">Rejected: {scenario.rejectedReason}</div>}

      <div className="flex flex-wrap gap-2 pt-1">
        {canApprove && (
          <Button variant="primary" onClick={() => approve.mutate()} disabled={approve.isPending}>
            {scenario.status === "grounded_pending_review" ? "Send to test generation" : "Approve"}
          </Button>
        )}
        {scenario.status !== "rejected" && (
          <Button variant="secondary" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
        )}
        <Button variant="secondary" onClick={() => setRegenOpen(true)}>
          Regenerate
        </Button>
        <Button variant="ghost" onClick={() => remove.mutate()}>
          Delete
        </Button>
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject scenario">
        <textarea
          className="w-full h-20 bg-panel-2 border border-border rounded-md px-3 py-2 text-sm mb-3"
          placeholder="Why is this scenario being rejected?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => reject.mutate()} disabled={!reason.trim() || reject.isPending}>
            Reject
          </Button>
        </div>
      </Modal>

      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title="Regenerate scenario">
        <textarea
          className="w-full h-20 bg-panel-2 border border-border rounded-md px-3 py-2 text-sm mb-3"
          placeholder="Optional feedback for the AI on what to change"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRegenOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
            {regenerate.isPending ? "Regenerating..." : "Regenerate"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function BugFlag() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-fail text-white" title="Classified as a real product defect">
      🐛 Bug
    </span>
  );
}

function TestRunCaseRow({ testCase }: { testCase: TestRunCase }) {
  const [open, setOpen] = useState(false);
  const isBug = testCase.classification === "REAL_DEFECT";
  return (
    <div className="border-t border-border first:border-t-0">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-panel-2">
        <span className="text-left flex items-center gap-2">
          {isBug && <BugFlag />}
          <span>
            {testCase.suiteTitle && <span className="text-muted">{testCase.suiteTitle} &rsaquo; </span>}
            {testCase.title}
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-muted mono">{formatDuration(testCase.durationMs)}</span>
          <StatusBadge status={testCase.status} />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 text-xs">
          {testCase.errorMessage && (
            <pre className="mono bg-black/40 border border-fail/30 text-fail rounded-md p-2.5 overflow-x-auto whitespace-pre-wrap">{testCase.errorMessage}</pre>
          )}
          {testCase.classification && (
            <div className={`rounded-md border p-2.5 space-y-1.5 ${isBug ? "border-fail/40 bg-fail/5" : "border-border bg-panel-2"}`}>
              <div className="flex items-center gap-2">
                {isBug && <BugFlag />}
                <StatusBadge status={testCase.classification} />
                {testCase.classificationConfidence != null && (
                  <span className="text-muted">{Math.round(testCase.classificationConfidence * 100)}% confidence</span>
                )}
                {testCase.classificationEvidenceKind && (
                  <span className="text-muted">&middot; {testCase.classificationEvidenceKind.replace(/_/g, " ").toLowerCase()}</span>
                )}
              </div>
              {testCase.classificationReasoning && <div>{testCase.classificationReasoning}</div>}
              {testCase.suggestedFix && (
                <div>
                  <span className="text-muted">Suggested fix: </span>
                  {testCase.suggestedFix}
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3">
            {testCase.screenshotPath && (
              <a href={`/artifacts/${testCase.screenshotPath}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Screenshot
              </a>
            )}
            {testCase.tracePath && (
              <a href={`/artifacts/${testCase.tracePath}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                Download trace ({`npx playwright show-trace <file>`})
              </a>
            )}
          </div>
          {testCase.screenshotPath && (
            <a href={`/artifacts/${testCase.screenshotPath}`} target="_blank" rel="noreferrer">
              <img src={`/artifacts/${testCase.screenshotPath}`} alt="Failure screenshot" className="max-w-sm rounded border border-border" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function TestRunsPanel({ fileId, committed }: { fileId: string; committed: boolean }) {
  const queryClient = useQueryClient();
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const { data: runs } = useQuery({
    queryKey: ["test-runs", fileId],
    queryFn: () => api.listTestRuns(fileId),
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "running") ? 2000 : false),
  });

  const run = useMutation({
    mutationFn: () => api.runTestFile(fileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["test-runs", fileId] }),
  });

  const latest = runs?.[0];
  const isRunning = latest?.status === "running";

  const { data: detail } = useQuery({
    queryKey: ["test-run", expandedRunId],
    queryFn: () => api.getTestRun(expandedRunId!),
    enabled: !!expandedRunId,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">CI/CD: run &amp; report</div>
        <Button
          variant="secondary"
          onClick={() => run.mutate()}
          disabled={!committed || run.isPending || isRunning}
          title={!committed ? "Commit this file to Git before running it" : undefined}
        >
          {isRunning ? "Running..." : "Run Test"}
        </Button>
      </div>

      {!runs || runs.length === 0 ? (
        <div className="text-xs text-muted">No test runs yet - commit this file, then click Run Test for a real pass/fail report.</div>
      ) : (
        <Card className="divide-y divide-border">
          {runs.map((r) => (
            <div key={r.id}>
              <button
                onClick={() => setExpandedRunId(expandedRunId === r.id ? null : r.id)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs hover:bg-panel-2"
              >
                <span className="flex items-center gap-2">
                  <StatusBadge status={r.status} />
                  <span className="text-muted">{r.triggeredBy === "auto_after_commit" ? "auto (after commit)" : "manual"}</span>
                </span>
                <span className="flex items-center gap-3 text-muted">
                  {r.totalTests != null && (
                    <span className="mono">
                      <span className="text-pass">{r.passedCount}</span>/{r.totalTests} passed
                    </span>
                  )}
                  <span className="mono">{formatDuration(r.durationMs)}</span>
                  <span>{new Date(r.startedAt).toLocaleString()}</span>
                </span>
              </button>
              {expandedRunId === r.id && (
                <div className="px-3 pb-3">
                  {r.errorMessage && <div className="text-xs text-fail mb-2">{r.errorMessage}</div>}
                  {detail?.run.id === r.id && detail.cases.length > 0 && (
                    <div className="border border-border rounded-md overflow-hidden">
                      {detail.cases.map((c) => (
                        <TestRunCaseRow key={c.id} testCase={c} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function TestFileCard({ file, requirementId }: { file: TestFile; requirementId: string }) {
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState(`Add generated tests for: ${file.filePath}`);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["requirement", requirementId] });
    queryClient.invalidateQueries({ queryKey: ["test-files"] });
  };

  const approve = useMutation({ mutationFn: () => api.approveTestFile(file.id), onSuccess: invalidate });
  const reject = useMutation({
    mutationFn: () => api.rejectTestFile(file.id, reason),
    onSuccess: () => {
      setRejectOpen(false);
      invalidate();
    },
  });
  const regenerate = useMutation({ mutationFn: () => api.regenerateTestFile(file.id), onSuccess: invalidate });
  const commit = useMutation({
    mutationFn: () => api.commitTestFiles([file.id], message),
    onSuccess: () => {
      setCommitOpen(false);
      invalidate();
    },
  });

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm mono">
          {file.filePath} <span className="text-muted">v{file.version}</span>
        </div>
        <StatusBadge status={file.status} />
      </div>
      {file.validationError && <div className="text-xs text-fail">{file.validationError}</div>}
      <pre className="bg-black/40 border border-border rounded-md p-3 text-xs overflow-x-auto max-h-96 mono">{file.code}</pre>
      <div className="flex flex-wrap gap-2">
        {file.status === "syntax_valid" && (
          <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
            Approve
          </Button>
        )}
        {file.status === "approved" && <Button onClick={() => setCommitOpen(true)}>Commit to Git</Button>}
        {(file.status === "syntax_valid" || file.status === "syntax_invalid") && (
          <Button variant="secondary" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
        )}
        <Button variant="secondary" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
          {regenerate.isPending ? "Regenerating..." : "Regenerate"}
        </Button>
      </div>

      <div className="pt-2 border-t border-border">
        <TestRunsPanel fileId={file.id} committed={file.status === "committed"} />
      </div>

      <Modal open={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject generated test">
        <textarea
          className="w-full h-20 bg-panel-2 border border-border rounded-md px-3 py-2 text-sm mb-3"
          placeholder="Why is this code being rejected?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setRejectOpen(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => reject.mutate()} disabled={!reason.trim()}>
            Reject
          </Button>
        </div>
      </Modal>

      <Modal open={commitOpen} onClose={() => setCommitOpen(false)} title="Commit to Git">
        <input
          className="w-full bg-panel-2 border border-border rounded-md px-3 py-2 text-sm mb-3"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCommitOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => commit.mutate()} disabled={!message.trim() || commit.isPending}>
            {commit.isPending ? "Committing..." : "Commit"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

export function RequirementDetail() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data } = useQuery({ queryKey: ["requirement", id], queryFn: () => api.getRequirement(id!), enabled: !!id });
  const { data: exploration } = useQuery({
    queryKey: ["exploration", id],
    queryFn: () => api.getExploration(id!),
    enabled: !!id && !!data && data.requirement.status !== "submitted" && data.requirement.status !== "analyzing",
  });
  const { data: testFiles } = useQuery({ queryKey: ["test-files", id], queryFn: () => api.listTestFiles(id!), enabled: !!id });
  const { data: agentRuns } = useQuery({ queryKey: ["agent-runs", id], queryFn: () => api.listAgentRuns({ requirementId: id! }), enabled: !!id });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["requirement", id] });
    queryClient.invalidateQueries({ queryKey: ["exploration", id] });
    queryClient.invalidateQueries({ queryKey: ["test-files", id] });
    queryClient.invalidateQueries({ queryKey: ["agent-runs", id] });
  };

  const analyze = useMutation({ mutationFn: () => api.analyzeRequirement(id!), onSuccess: invalidateAll });
  const plan = useMutation({ mutationFn: () => api.planRequirement(id!), onSuccess: invalidateAll });
  const generate = useMutation({ mutationFn: () => api.generateRequirement(id!), onSuccess: invalidateAll });

  if (!data) return <div className="p-8 text-sm text-muted">Loading...</div>;
  const { requirement, analysis, scenarios } = data;

  const hasApprovedScenarios = scenarios.some((s) => s.status === "approved");
  const hasReadyForGeneration = scenarios.some((s) => s.status === "approved_for_generation");
  const latestTestFile = testFiles?.find((f) => f.isLatest);

  return (
    <div>
      <PageHeader
        title={requirement.title}
        subtitle={`Submitted by ${requirement.submittedBy} on ${new Date(requirement.createdAt).toLocaleString()}`}
        actions={<StatusBadge status={requirement.status} />}
      />
      <div className="p-8 space-y-8 max-w-4xl">
        <Card className="p-4">
          <div className="text-sm">{requirement.rawText}</div>
        </Card>

        {/* AI Testing Intelligence Layer */}
        <Section
          title="AI analysis"
          actions={
            <Button variant="secondary" onClick={() => analyze.mutate()} disabled={analyze.isPending}>
              {analyze.isPending ? "Analyzing..." : analysis ? "Re-analyze" : "Analyze"}
            </Button>
          }
        >
          {analysis ? (
            <Card className="p-4 space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted mb-1">Functional requirements</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {analysis.functionalRequirements.map((f, i) => (
                    <li key={i}>{f.description}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">User roles</div>
                {analysis.userRoles.join(", ")}
              </div>
              <div>
                <div className="text-xs text-muted mb-1">Validation rules</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {analysis.validationRules.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">Risk areas</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {analysis.riskAreas.map((r, i) => (
                    <li key={i}>
                      <span className="font-medium">{r.area}</span>: {r.reason}
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ) : (
            <div className="text-sm text-muted">Not analyzed yet.</div>
          )}
        </Section>

        {/* Scenario Management (scoped to this requirement) */}
        <Section title={`Scenarios (${scenarios.length})`}>
          <div className="space-y-3">
            {scenarios.map((s) => (
              <ScenarioCard key={s.id} scenario={s} requirementId={id!} />
            ))}
            {scenarios.length === 0 && <div className="text-sm text-muted">No scenarios yet - run analysis first.</div>}
          </div>
        </Section>

        {/* Playwright Planner Control */}
        <Section
          title="Playwright Planner"
          actions={
            <Button variant="secondary" onClick={() => plan.mutate()} disabled={!hasApprovedScenarios || plan.isPending}>
              {plan.isPending ? "Planning..." : "Run Planner"}
            </Button>
          }
        >
          {exploration ? (
            <Card className="p-4 space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted mb-1">Routes discovered</div>
                {exploration.discoveredRoutes.join(", ") || "(none)"}
              </div>
              <div>
                <div className="text-xs text-muted mb-1">Flows discovered</div>
                <ul className="list-disc pl-5 space-y-0.5">
                  {exploration.discoveredFlows.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">Testids ({exploration.discoveredTestIds.length})</div>
                <div className="flex flex-wrap gap-1.5">
                  {exploration.discoveredTestIds.slice(0, 30).map((t) => (
                    <span key={t.testId} className="mono text-[11px] px-1.5 py-0.5 rounded bg-panel-2 border border-border">
                      {t.testId} <span className="text-muted">({t.source})</span>
                    </span>
                  ))}
                </div>
              </div>
              {exploration.crossReferenceNotes.length > 0 && (
                <div>
                  <div className="text-xs text-muted mb-1">Cross-reference notes</div>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {exploration.crossReferenceNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ) : (
            <div className="text-sm text-muted">No exploration run yet - approve at least one scenario, then run the Planner.</div>
          )}
        </Section>

        {/* Playwright Generator */}
        <Section
          title="Generated tests"
          actions={
            <Button variant="secondary" onClick={() => generate.mutate()} disabled={!hasReadyForGeneration || generate.isPending}>
              {generate.isPending ? "Generating..." : "Generate Tests"}
            </Button>
          }
        >
          {latestTestFile ? <TestFileCard file={latestTestFile} requirementId={id!} /> : <div className="text-sm text-muted">No tests generated yet.</div>}
        </Section>

        {/* Agent activity for this requirement */}
        <Section title="Agent activity">
          <Card className="divide-y divide-border">
            {agentRuns?.map((r) => (
              <div key={r.id} className="p-3 text-xs flex items-center justify-between">
                <div>
                  <span className="font-medium capitalize">{r.agentType}</span> - {r.currentTask}
                </div>
                <StatusBadge status={r.status} />
              </div>
            ))}
            {(!agentRuns || agentRuns.length === 0) && <div className="p-4 text-sm text-muted">No agent activity yet.</div>}
          </Card>
        </Section>
      </div>
    </div>
  );
}
