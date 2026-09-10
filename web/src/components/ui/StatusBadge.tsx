const COLOR_MAP: Record<string, string> = {
  // requirement / general
  submitted: "bg-panel-2 text-muted border-border",
  analyzing: "bg-accent/15 text-accent border-accent/30",
  awaiting_scenario_approval: "bg-warn/15 text-warn border-warn/30",
  planning: "bg-accent/15 text-accent border-accent/30",
  awaiting_plan_approval: "bg-warn/15 text-warn border-warn/30",
  generating_tests: "bg-accent/15 text-accent border-accent/30",
  awaiting_test_approval: "bg-warn/15 text-warn border-warn/30",
  committed: "bg-pass/15 text-pass border-pass/30",
  failed: "bg-fail/15 text-fail border-fail/30",
  // scenario
  ai_proposed: "bg-warn/15 text-warn border-warn/30",
  approved: "bg-pass/15 text-pass border-pass/30",
  rejected: "bg-fail/15 text-fail border-fail/30",
  grounding_in_progress: "bg-accent/15 text-accent border-accent/30",
  grounded_pending_review: "bg-warn/15 text-warn border-warn/30",
  approved_for_generation: "bg-pass/15 text-pass border-pass/30",
  // test file
  generating: "bg-accent/15 text-accent border-accent/30",
  syntax_valid: "bg-pass/15 text-pass border-pass/30",
  syntax_invalid: "bg-fail/15 text-fail border-fail/30",
  pending_approval: "bg-warn/15 text-warn border-warn/30",
  // agent run
  queued: "bg-panel-2 text-muted border-border",
  running: "bg-accent/15 text-accent border-accent/30",
  completed: "bg-pass/15 text-pass border-pass/30",
  cancelled: "bg-panel-2 text-muted border-border",
  // test run / test run case
  passed: "bg-pass/15 text-pass border-pass/30",
  error: "bg-fail/15 text-fail border-fail/30",
  timedOut: "bg-fail/15 text-fail border-fail/30",
  skipped: "bg-panel-2 text-muted border-border",
  interrupted: "bg-warn/15 text-warn border-warn/30",
  // failure classification (only REAL_DEFECT is flagged as a "Bug" in the UI)
  REAL_DEFECT: "bg-fail/15 text-fail border-fail/30",
  ENVIRONMENT_ERROR: "bg-accent/15 text-accent border-accent/30",
  TEST_SCRIPT_ERROR: "bg-panel-2 text-muted border-border",
  UI_LOCATOR_CHANGE: "bg-warn/15 text-warn border-warn/30",
  INCONCLUSIVE: "bg-panel-2 text-muted border-border",
};

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const classes = COLOR_MAP[status] ?? "bg-panel-2 text-muted border-border";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${classes}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {label ?? status.replace(/_/g, " ")}
    </span>
  );
}
