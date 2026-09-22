import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import { formatDuration, TestRunCaseRow } from "@/components/TestRunCaseRow";
import type { TestHistoryEntry, TestRunStatus } from "@/lib/types";

// "Test Cases" hierarchy: Website -> Date -> Test Case -> Execution.
// Reuses the existing test_runs/test_run_cases data (GET /api/test-history,
// see server/routes/testHistory.ts) rather than introducing any new storage -
// every execution is already its own immutable row, this page just presents
// it grouped, searchable and filterable across every requirement at once.

function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

function useToggle(initial: Iterable<string> = []) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initial));
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  return { expanded, toggle };
}

function CollapsibleHeader({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-panel-2 transition-colors">
      <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
      {children}
    </button>
  );
}

function ExecutionRow({ entry }: { entry: TestHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const { data: detail } = useQuery({
    queryKey: ["test-run", entry.testRunId],
    queryFn: () => api.getTestRun(entry.testRunId),
    enabled: open,
  });

  return (
    <div className="border-t border-border first:border-t-0">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-panel-2">
        <span className="flex items-center gap-2">
          <StatusBadge status={entry.status} />
          <span className="text-muted">{entry.triggeredBy === "auto_after_commit" ? "auto (after commit)" : "manual"}</span>
        </span>
        <span className="flex items-center gap-3 text-muted">
          {entry.totalTests != null && (
            <span className="mono">
              <span className="text-pass">{entry.passedCount}</span>/{entry.totalTests} passed
            </span>
          )}
          <span className="mono">{formatDuration(entry.durationMs)}</span>
          <span>{new Date(entry.startedAt).toLocaleString()}</span>
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3">
          {entry.errorMessage && <div className="text-xs text-fail mb-2">{entry.errorMessage}</div>}
          {detail?.run.id === entry.testRunId && detail.cases.length > 0 && (
            <div className="border border-border rounded-md overflow-hidden">
              {detail.cases.map((c) => (
                <TestRunCaseRow key={c.id} testCase={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RunAgainButton({ fileId, fileStatus }: { fileId: string; fileStatus: string }) {
  const queryClient = useQueryClient();
  const run = useMutation({
    mutationFn: () => api.runTestFile(fileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-history"] });
      queryClient.invalidateQueries({ queryKey: ["test-runs", fileId] });
    },
  });
  const committed = fileStatus === "committed";
  return (
    <Button
      variant="secondary"
      onClick={(e) => {
        e.stopPropagation();
        run.mutate();
      }}
      disabled={!committed || run.isPending}
      title={!committed ? "The latest generated test for this case isn't committed to Git yet" : "Re-run this test case"}
    >
      {run.isPending ? "Running..." : "Run again"}
    </Button>
  );
}

interface TestCaseGroup {
  requirementId: string;
  testCaseName: string;
  latestFileId: string;
  latestFileStatus: string;
  executions: TestHistoryEntry[];
}

function TestCaseNode({ group, path }: { group: TestCaseGroup; path: string }) {
  const key = `${path}|${group.requirementId}`;
  const { expanded, toggle } = useToggle();
  const open = expanded.has(key);
  const latest = group.executions[0];

  return (
    <div className="border-t border-border first:border-t-0">
      <div className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-panel-2 transition-colors">
        {/* A <button> can't legally contain the <a> (Link) below - nested
            interactive elements produce inconsistent browser behavior - so
            this toggle is a div with a button role instead. */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => toggle(key)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              toggle(key);
            }
          }}
          className="flex items-center gap-2 min-w-0 text-left flex-1 cursor-pointer"
        >
          <ChevronRight className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
          <div className="min-w-0">
            <Link
              to={`/requirements/${group.requirementId}`}
              onClick={(e) => e.stopPropagation()}
              className="text-sm font-medium hover:text-accent truncate block"
            >
              {group.testCaseName}
            </Link>
            <div className="text-[11px] text-muted mono truncate">
              {group.requirementId} &middot; {group.executions.length} execution{group.executions.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={latest.status} />
          <RunAgainButton fileId={group.latestFileId} fileStatus={group.latestFileStatus} />
        </div>
      </div>
      {open && (
        <div className="pl-5">
          {group.executions.map((e) => (
            <ExecutionRow key={e.testRunId} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}

interface DateGroup {
  dateKey: string;
  testCases: TestCaseGroup[];
}

function DateNode({ group, path }: { group: DateGroup; path: string }) {
  const key = `${path}|${group.dateKey}`;
  const { expanded, toggle } = useToggle([key]);
  const open = expanded.has(key);
  const total = group.testCases.length;
  const passed = group.testCases.filter((tc) => tc.executions[0].status === "passed").length;

  return (
    <Card className="overflow-hidden">
      <CollapsibleHeader open={open} onToggle={() => toggle(key)}>
        <span className="text-sm font-medium flex-1">{formatDateLabel(group.dateKey)}</span>
        <span className="text-xs text-muted mono">
          {passed}/{total} test cases passing
        </span>
      </CollapsibleHeader>
      {open && (
        <div className="border-t border-border divide-y divide-border">
          {group.testCases.map((tc) => (
            <TestCaseNode key={tc.requirementId} group={tc} path={key} />
          ))}
        </div>
      )}
    </Card>
  );
}

interface WebsiteGroup {
  website: string;
  dates: DateGroup[];
}

function WebsiteNode({ group }: { group: WebsiteGroup }) {
  const key = `website:${group.website}`;
  const { expanded, toggle } = useToggle([key]);
  const open = expanded.has(key);
  const totalCases = group.dates.reduce((sum, d) => sum + d.testCases.length, 0);

  return (
    <div>
      <button onClick={() => toggle(key)} className="w-full flex items-center gap-2 mb-2">
        <ChevronRight className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
        <h2 className="text-sm font-semibold">{group.website}</h2>
        <span className="text-xs text-muted">
          ({group.dates.length} day{group.dates.length === 1 ? "" : "s"}, {totalCases} test case{totalCases === 1 ? "" : "s"})
        </span>
      </button>
      {open && (
        <div className="space-y-3 pl-1">
          {group.dates.map((d) => (
            <DateNode key={d.dateKey} group={d} path={key} />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_OPTIONS: { value: "all" | TestRunStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "error", label: "Error" },
  { value: "running", label: "Running" },
];

export function TestHistory() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["test-history"],
    queryFn: api.getTestHistory,
    refetchInterval: (query) => (query.state.data?.some((e) => e.status === "running") ? 3000 : false),
  });

  const [search, setSearch] = useState("");
  const [website, setWebsite] = useState("all");
  const [status, setStatus] = useState<"all" | TestRunStatus>("all");
  const [date, setDate] = useState("");

  const websites = useMemo(() => Array.from(new Set((data ?? []).map((e) => e.website))).sort(), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      if (website !== "all" && e.website !== website) return false;
      if (status !== "all" && e.status !== status) return false;
      if (date && toDateKey(e.startedAt) !== date) return false;
      if (q && !e.testCaseName.toLowerCase().includes(q) && !e.requirementId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, website, status, date]);

  const grouped = useMemo<WebsiteGroup[]>(() => {
    // website -> dateKey -> requirementId -> entries (already sorted desc by
    // startedAt from the API, so the first entry per bucket is the latest).
    const byWebsite = new Map<string, Map<string, Map<string, TestHistoryEntry[]>>>();
    for (const entry of filtered) {
      const dateKey = toDateKey(entry.startedAt);
      const byDate = byWebsite.get(entry.website) ?? new Map();
      byWebsite.set(entry.website, byDate);
      const byCase = byDate.get(dateKey) ?? new Map();
      byDate.set(dateKey, byCase);
      const list = byCase.get(entry.requirementId) ?? [];
      list.push(entry);
      byCase.set(entry.requirementId, list);
    }

    return Array.from(byWebsite.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([site, byDate]) => ({
        website: site,
        dates: Array.from(byDate.entries())
          .sort(([a], [b]) => (a < b ? 1 : -1)) // most recent date first
          .map(([dateKey, byCase]) => ({
            dateKey,
            testCases: Array.from(byCase.entries())
              .map(([requirementId, executions]) => ({
                requirementId,
                testCaseName: executions[0].testCaseName,
                latestFileId: executions[0].testFileId,
                latestFileStatus: executions[0].fileStatus,
                executions,
              }))
              .sort((a, b) => a.testCaseName.localeCompare(b.testCaseName)),
          })),
      }));
  }, [filtered]);

  const clearFilters = () => {
    setSearch("");
    setWebsite("all");
    setStatus("all");
    setDate("");
  };
  const hasFilters = !!search || website !== "all" || status !== "all" || !!date;

  return (
    <div>
      <PageHeader
        title="Test History"
        subtitle="Every test execution across every website/application - organized as Website > Date > Test Case > Execution"
      />
      <div className="p-4 space-y-4 sm:p-6 md:p-8">
        <Card className="p-4">
          <div className="flex flex-wrap gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by test case name or ID..."
              className="flex-1 min-w-[200px] bg-panel-2 border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
            <select
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="bg-panel-2 border border-border rounded-md px-3 py-2 text-sm"
            >
              <option value="all">All websites</option>
              {websites.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | TestRunStatus)}
              className="bg-panel-2 border border-border rounded-md px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-panel-2 border border-border rounded-md px-3 py-2 text-sm"
            />
            {hasFilters && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </div>
        </Card>

        {isLoading && <div className="text-sm text-muted">Loading test history...</div>}
        {isError && <div className="text-sm text-fail">Failed to load test history: {(error as Error).message}</div>}

        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <div className="text-sm text-muted p-6 text-center">
            No test executions yet - generate and run a test from a requirement, then it will show up here.
          </div>
        )}

        {!isLoading && !isError && (data?.length ?? 0) > 0 && grouped.length === 0 && (
          <div className="text-sm text-muted p-6 text-center">No executions match the current search/filters.</div>
        )}

        <div className="space-y-6">
          {grouped.map((g) => (
            <WebsiteNode key={g.website} group={g} />
          ))}
        </div>
      </div>
    </div>
  );
}
