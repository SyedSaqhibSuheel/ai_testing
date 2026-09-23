import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";

export function CodeAnalysis() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["code-modules"],
    queryFn: api.listCodeModules,
    refetchInterval: 4000,
  });

  const run = useMutation({
    mutationFn: (force: boolean) => api.runCodeAnalysis(force),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["code-modules"] }),
  });

  const modules = data?.modules ?? [];
  const analyzedCount = modules.filter((m) => m.requirementId && m.requirementStatus !== "failed").length;
  const running = data?.running ?? false;

  return (
    <div>
      <PageHeader
        title="Code Analysis"
        subtitle="No requirement text needed - scan the CallCenterUI app's own source code and let AI infer what to test"
      />
      <div className="p-8 space-y-6">
        <Card className="p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">
                {modules.length === 0 ? "Scanning source..." : `${analyzedCount} / ${modules.length} CallCenterUI screens analyzed`}
              </div>
              <p className="text-xs text-muted mt-1 max-w-xl">
                Reads every real screen/component in CallCenterUI (excludes the generic UI kit and demo wrappers - fidar-server is
                never analyzed on its own, only referenced as the API it calls), reverse-engineers each one's functional behavior
                straight from the code, and proposes draft test scenarios - the same pipeline Requirements uses from here on
                (approve scenarios, ground them against the live app, generate Playwright tests).
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                onClick={() => run.mutate(true)}
                disabled={running || run.isPending}
                title="Re-analyze every module, including ones already analyzed"
              >
                Re-analyze all
              </Button>
              <Button onClick={() => run.mutate(false)} disabled={running || run.isPending || analyzedCount === modules.length}>
                {running ? "Analyzing..." : "Analyze remaining modules"}
              </Button>
            </div>
          </div>
          {run.isError && <p className="text-xs text-fail mt-3">{(run.error as Error).message}</p>}
          {running && (
            <p className="text-xs text-muted mt-3">
              Running in the background - each module becomes a requirement below as soon as it's analyzed. Safe to navigate away.
            </p>
          )}
        </Card>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Discovered screens/components {modules.length ? `(${modules.length})` : ""}</h2>
          <Card className="divide-y divide-border">
            {modules.length === 0 && <div className="p-6 text-sm text-muted text-center">No CallCenterUI screens found by the source scanner yet.</div>}
            {modules.map((m) => (
              <div key={m.name} className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{m.name}</div>
                  <div className="text-xs text-muted mt-1 truncate">
                    {m.relativePath} &middot; {m.testIdCount} interactive element{m.testIdCount === 1 ? "" : "s"} found
                  </div>
                </div>
                {m.requirementId ? (
                  <Link to={`/requirements/${m.requirementId}`} className="shrink-0">
                    <StatusBadge status={m.requirementStatus ?? "submitted"} />
                  </Link>
                ) : (
                  <span className="shrink-0 text-xs text-muted-2">Not yet analyzed</span>
                )}
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
