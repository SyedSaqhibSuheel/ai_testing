import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Clock3, Globe, History, RotateCw, Search, UserRound, X, Zap } from "lucide-react";
import { api } from "@/lib/api";
import { formatDuration, TestRunCaseRow } from "@/components/TestRunCaseRow";
import {
  EmptyState,
  ErrorState,
  PageBody,
  PageHeader,
  PageShell,
  ProgressBar,
  SelectField,
  SkeletonRows,
  StatusPill,
  Surface,
  TONE,
  TextAction,
  TextInput,
  cx,
  inputClass,
  statusTone,
} from "@/components/workspace/kit";
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

function Chevron({ open, className }: { open: boolean; className?: string }) {
  return <ChevronRight className={cx("h-4 w-4 shrink-0 text-muted transition-transform duration-200", open && "rotate-90", className)} />;
}

function ExecutionRow({ entry }: { entry: TestHistoryEntry }) {
  const [open, setOpen] = useState(false);
  const { data: detail } = useQuery({
    queryKey: ["test-run", entry.testRunId],
    queryFn: () => api.getTestRun(entry.testRunId),
    enabled: open,
  });
  const auto = entry.triggeredBy === "auto_after_commit";

  return (
    <div className="relative">
      <span className={cx("absolute -left-[4.5px] top-[17px] h-2 w-2 rounded-full", TONE[statusTone(entry.status)].dot)} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full flex-col gap-2 rounded-lg py-2 pl-5 pr-3 text-left text-sm transition-colors hover:bg-panel-2/50 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="flex items-center gap-3">
          <StatusPill status={entry.status} />
          <span className="inline-flex items-center gap-1.5 text-xs text-muted">
            {auto ? <Zap className="h-3 w-3" /> : <UserRound className="h-3 w-3" />}
            {auto ? "auto (after commit)" : "manual"}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          {entry.totalTests != null && (
            <span className="tabular-nums">
              <span className="font-medium text-pass">{entry.passedCount}</span>/{entry.totalTests} passed
            </span>
          )}
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock3 className="h-3 w-3" />
            {formatDuration(entry.durationMs)}
          </span>
          <span>{new Date(entry.startedAt).toLocaleString()}</span>
          <Chevron open={open} className="hidden h-3.5 w-3.5 sm:block" />
        </span>
      </button>
      {open && (
        <div className="ws-rise pb-2 pl-5 pr-3">
          {entry.errorMessage && <div className="mb-2 rounded-lg border border-fail/20 bg-fail/5 px-3 py-2 text-xs text-fail">{entry.errorMessage}</div>}
          {detail?.run.id === entry.testRunId && detail.cases.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border bg-panel">
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
    <TextAction
      icon={RotateCw}
      spinning={run.isPending}
      onClick={(e) => {
        e.stopPropagation();
        run.mutate();
      }}
      disabled={!committed || run.isPending}
      title={!committed ? "The latest generated test for this case isn't committed to Git yet" : "Re-run this test case"}
    >
      {run.isPending ? "Running..." : "Run again"}
    </TextAction>
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
    <div>
      <div className={cx("flex flex-col gap-3 px-6 py-3.5 transition-colors hover:bg-panel-2/40 md:grid md:grid-cols-[minmax(0,1fr)_150px_130px] md:items-center md:gap-4", open && "bg-panel-2/30")}>
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
          className="flex min-w-0 cursor-pointer items-center gap-3 text-left focus-visible:outline-none"
        >
          <Chevron open={open} />
          <div className="min-w-0">
            <Link
              to={`/requirements/${group.requirementId}`}
              onClick={(e) => e.stopPropagation()}
              className="block truncate font-medium text-text transition-colors hover:text-primary"
            >
              {group.testCaseName}
            </Link>
            <div className="mono mt-0.5 truncate text-xs text-muted">
              {group.requirementId} &middot; {group.executions.length} execution{group.executions.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="pl-7 md:pl-0">
          <StatusPill status={latest.status} />
        </div>
        <div className="pl-5 md:flex md:justify-end md:pl-0">
          <RunAgainButton fileId={group.latestFileId} fileStatus={group.latestFileStatus} />
        </div>
      </div>
      {open && (
        <div className="ws-rise bg-panel-2/30 pb-3 pl-[50px] pr-6">
          <div className="border-l border-border">
            {group.executions.map((e) => (
              <ExecutionRow key={e.testRunId} entry={e} />
            ))}
          </div>
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
  const rate = total ? passed / total : 0;

  return (
    <div className="border-t border-border first:border-t-0">
      <button type="button" onClick={() => toggle(key)} className="flex w-full items-center gap-3 bg-panel-2/40 px-6 py-2.5 text-left transition-colors hover:bg-panel-2/70">
        <Chevron open={open} className="h-3.5 w-3.5" />
        <span className="mono flex-1 whitespace-nowrap text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted">{formatDateLabel(group.dateKey)}</span>
        <ProgressBar value={rate} tone={rate === 1 ? "pass" : rate >= 0.5 ? "warn" : "fail"} className="hidden w-24 sm:block" />
        <span className="text-xs text-muted tabular-nums">
          {passed}/{total} test cases passing
        </span>
      </button>
      {open && (
        <div className="divide-y divide-border border-t border-border">
          {group.testCases.map((tc) => (
            <TestCaseNode key={tc.requirementId} group={tc} path={key} />
          ))}
        </div>
      )}
    </div>
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
    <Surface className="overflow-hidden">
      <button type="button" onClick={() => toggle(key)} className="group flex w-full items-center gap-3 px-6 py-4 text-left">
        <Globe className="h-4 w-4 shrink-0 text-muted" />
        <h2 className="truncate text-sm font-semibold text-text transition-colors group-hover:text-primary">{group.website}</h2>
        <span className="hidden text-sm text-muted sm:inline">
          {group.dates.length} day{group.dates.length === 1 ? "" : "s"} · {totalCases} test case{totalCases === 1 ? "" : "s"}
        </span>
        <Chevron open={open} className="ml-auto" />
      </button>
      {open && (
        <div className="border-t border-border">
          {group.dates.map((d) => (
            <DateNode key={d.dateKey} group={d} path={key} />
          ))}
        </div>
      )}
    </Surface>
  );
}

const STATUS_OPTIONS: { value: "all" | TestRunStatus; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "error", label: "Error" },
  { value: "skipped", label: "Skipped" },
  { value: "running", label: "Running" },
];

export function TestHistory() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["test-history"],
    queryFn: api.getTestHistory,
    refetchInterval: (query) => (query.state.data?.some((e) => e.status === "running") ? 3000 : false),
  });
  const { data: applications } = useQuery({ queryKey: ["applications"], queryFn: api.listApplications });

  const [search, setSearch] = useState("");
  const [website, setWebsite] = useState("all");
  const [applicationId, setApplicationId] = useState("all");
  const [status, setStatus] = useState<"all" | TestRunStatus>("all");
  const [date, setDate] = useState("");

  const websites = useMemo(() => Array.from(new Set((data ?? []).map((e) => e.website))).sort(), [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data ?? []).filter((e) => {
      if (website !== "all" && e.website !== website) return false;
      if (applicationId !== "all" && e.applicationId !== applicationId) return false;
      if (status !== "all" && e.status !== status) return false;
      if (date && toDateKey(e.startedAt) !== date) return false;
      if (q && !e.testCaseName.toLowerCase().includes(q) && !e.requirementId.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [data, search, website, applicationId, status, date]);

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
    setApplicationId("all");
    setStatus("all");
    setDate("");
  };
  const hasFilters = !!search || website !== "all" || applicationId !== "all" || status !== "all" || !!date;

  return (
    <PageShell>
      <PageHeader
        trail={["Execution", "Test history"]}
        live={data?.some((e) => e.status === "running") ? "Refreshing while runs are in progress" : undefined}
        title="Test History"
        subtitle="Every test execution across every website/application - organized as Website > Date > Test Case > Execution" />

      <PageBody>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_170px_190px_150px_160px_auto]">
          <TextInput
            icon={Search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by test case name or ID..."
            className="sm:col-span-2 xl:col-span-1"
          />
          <SelectField value={website} onChange={(e) => setWebsite(e.target.value)}>
            <option value="all">All websites</option>
            {websites.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </SelectField>
          <SelectField value={applicationId} onChange={(e) => setApplicationId(e.target.value)}>
            <option value="all">All applications</option>
            {applications?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
          <SelectField value={status} onChange={(e) => setStatus(e.target.value as "all" | TestRunStatus)}>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </SelectField>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          {hasFilters && (
            <TextAction icon={X} onClick={clearFilters} className="h-10 justify-center">
              Clear
            </TextAction>
          )}
        </div>

        {isLoading && (
          <Surface className="overflow-hidden">
            <SkeletonRows rows={5} />
          </Surface>
        )}
        {isError && <ErrorState>Failed to load test history: {(error as Error).message}</ErrorState>}

        {!isLoading && !isError && (data?.length ?? 0) === 0 && (
          <Surface>
            <EmptyState icon={History} title="No test executions yet" description="Generate and run a test from a requirement, then it will show up here." />
          </Surface>
        )}

        {!isLoading && !isError && (data?.length ?? 0) > 0 && grouped.length === 0 && (
          <Surface>
            <EmptyState icon={Search} title="Nothing matches" description="No executions match the current search/filters." />
          </Surface>
        )}

        {grouped.map((g) => (
          <WebsiteNode key={g.website} group={g} />
        ))}
      </PageBody>
    </PageShell>
  );
}
