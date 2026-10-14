import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, ListChecks, Search, Sparkles, UserRound, X } from "lucide-react";
import { api } from "@/lib/api";
import {
  Btn,
  Dialog,
  EmptyState,
  PageBody,
  PageHeader,
  PageShell,
  SkeletonRows,
  StatusPill,
  Surface,
  Tabs,
  IconButton,
  TextInput,
  TableFooter,
  cx,
  inputClass,
  tableHeadClass,
  tableRowClass,
} from "@/components/workspace/kit";
import type { Scenario, ScenarioStatus } from "@/lib/types";

const STATUS_FILTERS: { label: string; value: ScenarioStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Awaiting approval", value: "ai_proposed" },
  { label: "Approved", value: "approved" },
  { label: "Awaiting plan review", value: "grounded_pending_review" },
  { label: "Ready for generation", value: "approved_for_generation" },
  { label: "Rejected", value: "rejected" },
];

const GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_220px_80px] lg:items-center lg:gap-6";

function Row({ scenario }: { scenario: Scenario }) {
  const queryClient = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["scenarios"] });

  const approve = useMutation({ mutationFn: () => api.approveScenario(scenario.id), onSuccess: invalidate });
  const reject = useMutation({
    mutationFn: () => api.rejectScenario(scenario.id, reason),
    onSuccess: () => {
      setRejectOpen(false);
      invalidate();
    },
  });
  const canApprove = scenario.status === "ai_proposed" || scenario.status === "grounded_pending_review";

  return (
    <div className={cx(tableRowClass, GRID, "min-h-[76px]")}>
      <div className="min-w-0">
        <Link
          to={`/requirements/${scenario.requirementId}`}
          title={scenario.title}
          className="line-clamp-2 font-medium leading-snug text-text transition-colors hover:text-primary"
        >
          {scenario.title}
        </Link>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted">
          {scenario.sourceType === "ai_generated" ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> AI generated
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <UserRound className="h-3 w-3" /> User added
            </span>
          )}
          <span>·</span>
          <span className="mono truncate">#{scenario.requirementId.slice(0, 8)}</span>
        </div>
      </div>

      <div>
        <StatusPill status={scenario.status} />
      </div>

      <div className="-ml-2 flex items-center gap-1 lg:ml-0 lg:justify-end">
        {canApprove && <IconButton icon={Check} label="Approve" positive onClick={() => approve.mutate()} disabled={approve.isPending} />}
        {scenario.status !== "rejected" && <IconButton icon={X} label="Reject" danger onClick={() => setRejectOpen(true)} />}
      </div>

      <Dialog
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        title="Reject scenario"
        description={scenario.title}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setRejectOpen(false)}>
              Cancel
            </Btn>
            <Btn variant="danger" onClick={() => reject.mutate()} disabled={!reason.trim()}>
              Reject
            </Btn>
          </>
        }
      >
        <label className="mb-2 block text-sm font-medium text-text">Reason</label>
        <textarea
          className={cx(inputClass, "h-28 resize-none py-2.5")}
          placeholder="Why is this scenario being rejected?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
      </Dialog>
    </div>
  );
}

export function Scenarios() {
  const [filter, setFilter] = useState<ScenarioStatus | "all">("all");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["scenarios", filter],
    queryFn: () => api.listScenarios(filter === "all" ? undefined : { status: filter }),
  });
  // Same key/fn as the "All" filter above, so this shares that cache entry and
  // only costs an extra request while a narrower filter is selected.
  const { data: all } = useQuery({
    queryKey: ["scenarios", "all"],
    queryFn: () => api.listScenarios(undefined),
  });

  const countOf = (status: ScenarioStatus) => all?.filter((s) => s.status === status).length ?? 0;
  const q = search.trim().toLowerCase();
  const visible = q ? data?.filter((s) => s.title.toLowerCase().includes(q)) : data;

  return (
    <PageShell>
      <PageHeader trail={["Test design", "Scenarios"]} title="Test Scenarios" subtitle="Every scenario across all requirements, in one place" />

      <PageBody>
        <Surface className="overflow-hidden">
          <div className="flex flex-col gap-3 px-6 pt-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-semibold text-text">Scenarios</h2>
            <TextInput icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search scenarios..." className="sm:w-80" />
          </div>
          <div className="border-b border-border px-6 pt-2">
            <Tabs
              value={filter}
              onChange={setFilter}
              options={STATUS_FILTERS.map((f) => ({ ...f, count: all ? (f.value === "all" ? all.length : countOf(f.value)) : undefined }))}
            />
          </div>

          <div className={cx(tableHeadClass, GRID)}>
            <span>Scenario</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {isLoading && <SkeletonRows rows={6} />}

          <div className="divide-y divide-border">
            {visible?.map((s) => (
              <Row key={s.id} scenario={s} />
            ))}
          </div>

          {visible?.length === 0 && (
            <EmptyState icon={ListChecks} title="No scenarios found" description={q ? "No scenarios match your search in this filter." : "No scenarios match this filter."} />
          )}

          {visible && visible.length > 0 && (
            <TableFooter
              left={`${visible.length} / ${all?.length ?? visible.length} scenarios`}
              right={all ? `${countOf("approved_for_generation")} ready for generation` : undefined}
            />
          )}
        </Surface>
      </PageBody>
    </PageShell>
  );
}
