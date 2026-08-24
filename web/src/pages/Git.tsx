import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/PageHeader";

export function GitPage() {
  const { data: status } = useQuery({ queryKey: ["git-status"], queryFn: api.getGitStatus, refetchInterval: 5000 });
  const { data: commits } = useQuery({ queryKey: ["git-commits"], queryFn: api.getGitCommits, refetchInterval: 5000 });

  return (
    <div>
      <PageHeader title="Git Integration" subtitle="Local repository the platform commits AI-generated tests into" />
      <div className="p-8 space-y-6 max-w-3xl">
        <Card className="p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Repository</span>
            <span className="mono">{status?.dir}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Branch</span>
            <span className="mono">{status?.branch}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Working tree</span>
            <span className={status?.isClean ? "text-pass" : "text-warn"}>{status?.isClean ? "Clean" : "Has changes"}</span>
          </div>
          {status && status.changedFiles.length > 0 && (
            <div>
              <div className="text-muted mb-1">Changed files</div>
              <ul className="mono text-xs space-y-0.5">
                {status.changedFiles.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Commit history</h2>
          <Card className="divide-y divide-border">
            {commits?.commits.map((c) => (
              <div key={c.id} className="p-3.5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="mono text-xs text-accent">{c.commitSha.slice(0, 10)}</span>
                  <span className="text-xs text-muted">{new Date(c.committedAt).toLocaleString()}</span>
                </div>
                <div className="mt-1">{c.message}</div>
                <div className="text-xs text-muted mt-1">
                  {c.author} &middot; {c.branch} &middot; PR: {c.prStatus.replace(/_/g, " ")}
                </div>
              </div>
            ))}
            {commits?.commits.length === 0 && <div className="p-6 text-sm text-muted text-center">No commits yet.</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
