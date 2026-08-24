import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import type { Scenario, ScenarioStatus } from "@/lib/types";

const STATUS_FILTERS: { label: string; value: ScenarioStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Awaiting approval", value: "ai_proposed" },
  { label: "Approved", value: "approved" },
  { label: "Awaiting plan review", value: "grounded_pending_review" },
  { label: "Ready for generation", value: "approved_for_generation" },
  { label: "Rejected", value: "rejected" },
];

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
    <div className="p-4 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <Link to={`/requirements/${scenario.requirementId}`} className="text-sm font-medium hover:text-accent">
          {scenario.title}
        </Link>
        <div className="text-xs text-muted mt-1">
          {scenario.priority} priority &middot; {scenario.riskLevel} risk
          {scenario.aiConfidence != null && ` · ${Math.round(scenario.aiConfidence * 100)}% confidence`}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={scenario.status} />
        {canApprove && (
          <Button variant="secondary" onClick={() => approve.mutate()} disabled={approve.isPending}>
            Approve
          </Button>
        )}
        {scenario.status !== "rejected" && (
          <Button variant="ghost" onClick={() => setRejectOpen(true)}>
            Reject
          </Button>
        )}
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
          <Button variant="danger" onClick={() => reject.mutate()} disabled={!reason.trim()}>
            Reject
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function Scenarios() {
  const [filter, setFilter] = useState<ScenarioStatus | "all">("all");
  const { data } = useQuery({
    queryKey: ["scenarios", filter],
    queryFn: () => api.listScenarios(filter === "all" ? undefined : { status: filter }),
  });

  return (
    <div>
      <PageHeader title="Test Scenarios" subtitle="Every scenario across all requirements, in one place" />
      <div className="p-8 space-y-4">
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                filter === f.value ? "bg-accent border-accent text-white" : "border-border text-muted hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Card className="divide-y divide-border">
          {data?.map((s) => (
            <Row key={s.id} scenario={s} />
          ))}
          {data?.length === 0 && <div className="p-6 text-sm text-muted text-center">No scenarios match this filter.</div>}
        </Card>
      </div>
    </div>
  );
}
