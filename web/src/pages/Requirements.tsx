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
  const [submitted, setSubmitted] = useState<{ id: string; title: string } | null>(null);
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const fullyAutomatic = settings?.approvalMode === "fully_automatic";
  // Submitting starts the analysis server-side (and, in Fully Automatic mode,
  // the whole plan → generate → commit → run chain), so keep the list live
  // while anything is still being worked on.
  const { data: requirements } = useQuery({
    queryKey: ["requirements"],
    queryFn: api.listRequirements,
    refetchInterval: (query) =>
      query.state.data?.some((r) => ["submitted", "analyzing", "planning", "generating_tests"].includes(r.status)) ? 3000 : false,
  });

  const createMutation = useMutation({
    mutationFn: () => api.createRequirement(rawText),
    onSuccess: (row) => {
      setRawText("");
      setSubmitted({ id: row.id, title: row.title });
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
          {submitted && (
            <p className="text-xs text-muted mt-2">
              <Link to={`/requirements/${submitted.id}`} className="text-accent hover:underline">{submitted.title}</Link>{" "}
              {fullyAutomatic
                ? "is being turned into test cases, then planned, generated, committed and run automatically (Fully Automatic mode)."
                : "is being turned into test cases. Review and approve them on its page."}
            </p>
          )}
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
                  <div className="text-sm font-medium truncate flex items-center gap-2">
                    {r.title}
                    {r.source === "code_analysis" && (
                      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-accent bg-accent/10 rounded px-1.5 py-0.5">
                        From code
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted mt-1">
  {r.submittedBy} &middot; {new Date(r.createdAt).toLocaleString()}
</div>
<div className="text-xs text-muted mt-2 line-clamp-2">
  {r.rawText}
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
