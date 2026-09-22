import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { TestRunCase } from "@/lib/types";

// Shared between RequirementDetail's per-requirement CI/CD panel and the
// cross-requirement Test History page, so both show identical failure /
// classification detail instead of two copies of this markup drifting apart.

export function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function BugFlag() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-fail text-white"
      title="Classified as a real product defect"
    >
      🐛 Bug
    </span>
  );
}

export function TestRunCaseRow({ testCase }: { testCase: TestRunCase }) {
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
