import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, FileDiff, GitBranch, GitCommitHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import {
  Chip,
  EmptyState,
  Field,
  IconButton,
  PageBody,
  PageHeader,
  PageShell,
  SkeletonRows,
  StatusPill,
  Surface,
  SurfaceHeader,
  TableFooter,
  cx,
  labelClass,
  tableHeadClass,
  tableRowClass,
  timeAgo,
} from "@/components/workspace/kit";

const GRID = "lg:grid lg:grid-cols-[150px_minmax(0,1fr)_130px_40px] lg:items-center lg:gap-6";

function CopyShaButton({ sha }: { sha: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      icon={copied ? Check : Copy}
      label={copied ? "Copied" : "Copy commit hash"}
      positive={copied}
      onClick={() => {
        navigator.clipboard
          ?.writeText(sha)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
    />
  );
}

export function GitPage() {
  const { data: status } = useQuery({ queryKey: ["git-status"], queryFn: api.getGitStatus, refetchInterval: 5000 });
  const { data: commits } = useQuery({ queryKey: ["git-commits"], queryFn: api.getGitCommits, refetchInterval: 5000 });

  return (
    <PageShell>
      <PageHeader trail={["Configuration", "Git"]} live="Auto-refreshes every 5 seconds" title="Git Integration" subtitle="Local repository the platform commits AI-generated tests into" />

      <PageBody>
        <Surface className="overflow-hidden">
          <SurfaceHeader eyebrow="Repository · status" title="Managed repository" />
          {!status && <SkeletonRows rows={2} />}
          {status && (
            <>
              <dl className="grid grid-cols-1 gap-6 px-6 py-5 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                <Field label="Repository" className="sm:col-span-2 lg:col-span-1">
                  <span className="mono break-all text-sm">{status.dir}</span>
                </Field>
                <Field label="Branch">
                  <span className="mono inline-flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-muted" />
                    {status.branch}
                  </span>
                </Field>
                <Field label="Working tree">
                  <Chip tone={status.isClean ? "pass" : "warn"}>{status.isClean ? "Clean" : "Has changes"}</Chip>
                </Field>
              </dl>
              {status.changedFiles.length > 0 && (
                <div className="border-t border-border px-6 py-5">
                  <div className={cx(labelClass, "mb-3")}>Changed files</div>
                  <ul className="space-y-2">
                    {status.changedFiles.map((f) => (
                      <li key={f} className="mono flex items-center gap-2.5 text-sm text-text">
                        <FileDiff className="h-4 w-4 shrink-0 text-warn" />
                        <span className="break-all">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </Surface>

        <Surface className="overflow-hidden">
          <SurfaceHeader eyebrow="Commits · log" title="Commit history" description="Commits made by the platform, newest first" />

          {!commits && <SkeletonRows rows={4} />}

          {commits && commits.commits.length > 0 && (
            <>
              <div className={cx(tableHeadClass, GRID)}>
                <span>Commit</span>
                <span>Message</span>
                <span>Status</span>
                <span />
              </div>
              <div className="divide-y divide-border">
                {commits.commits.map((c) => (
                  <div
                    key={c.id}
                    className={cx(tableRowClass, GRID, "py-5")}
                    title={`${c.author} · ${c.branch} · ${new Date(c.committedAt).toLocaleString()} (${timeAgo(c.committedAt)})`}
                  >
                    <div>
                      <span className="mono inline-flex items-center gap-2 rounded-md bg-primary/10 px-2 py-1 text-sm text-primary">
                        <GitCommitHorizontal className="h-3.5 w-3.5" />
                        {c.commitSha.slice(0, 10)}
                      </span>
                    </div>
                    <div className="min-w-0 break-words text-sm text-text lg:truncate">{c.message}</div>
                    <div className="flex items-center justify-between gap-3 lg:contents">
                      <div>
                        <StatusPill status="committed" />
                      </div>
                      <div className="lg:flex lg:justify-end">
                        <CopyShaButton sha={c.commitSha} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {commits?.commits.length === 0 && <EmptyState icon={GitCommitHorizontal} title="No commits yet" description="Approved test files you commit will appear here." />}
          {commits && commits.commits.length > 0 && (
            <TableFooter left={`${commits.commits.length} commits`} right={`Head ${commits.commits[0].commitSha.slice(0, 10)}`} />
          )}
        </Surface>
      </PageBody>
    </PageShell>
  );
}
