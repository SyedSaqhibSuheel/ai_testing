import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";

export function Requirements() {
  const queryClient = useQueryClient();
  const [rawText, setRawText] = useState("");
  const { data: requirements } = useQuery({ queryKey: ["requirements"], queryFn: api.listRequirements });

  const createMutation = useMutation({
    mutationFn: () => api.createRequirement(rawText),
    onSuccess: () => {
      setRawText("");
      queryClient.invalidateQueries({ queryKey: ["requirements"] });
    },
  });

  return (
    <div>
      <PageHeader title="Requirements" subtitle="Test requirements in plain English - the starting point for every pipeline run" />
      <div className="p-8 space-y-6">
        <Card className="p-5">
          <label className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 block">New requirement</label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder='e.g. "An administrator should be able to create a customer. Name and email are mandatory. Duplicate emails must be rejected. Normal users must not be allowed to create customers."'
            className="w-full min-h-24 bg-panel-2 border border-border rounded-md px-3 py-2.5 text-sm resize-y focus:outline-none focus:border-accent"
          />
          {createMutation.isError && <p className="text-xs text-fail mt-2">{(createMutation.error as Error).message}</p>}
          <div className="flex justify-end mt-3">
            <Button onClick={() => createMutation.mutate()} disabled={!rawText.trim() || createMutation.isPending}>
              {createMutation.isPending ? "Submitting..." : "Submit requirement"}
            </Button>
          </div>
        </Card>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
            All requirements {requirements ? `(${requirements.length})` : ""}
          </h2>
          <Card className="divide-y divide-border">
            {requirements?.length === 0 && <div className="p-6 text-sm text-muted text-center">No requirements yet - submit one above.</div>}
            {requirements?.map((r) => (
              <Link key={r.id} to={`/requirements/${r.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-panel-2 transition-colors">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted mt-1">
                    {r.submittedBy} &middot; {new Date(r.createdAt).toLocaleString()}
                  </div>
                </div>
                <StatusBadge status={r.status} />
              </Link>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
