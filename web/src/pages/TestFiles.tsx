import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, Check, ChevronDown, Code2, Download, FileCode2, GitCommitHorizontal, GitCompare, LoaderCircle, Play, RefreshCw, Search } from "lucide-react";
import { api } from "@/lib/api";
import {
  ActionMenu,
  Btn,
  Chip,
  CodeViewer,
  Dialog,
  EmptyState,
  IconButton,
  PageBody,
  PageHeader,
  PageShell,
  SkeletonRows,
  StatusPill,
  Surface,
  TextAction,
  TextInput,
  TableFooter,
  cx,
  inputClass,
  tableHeadClass,
  tableRowClass,
  timeAgo,
} from "@/components/workspace/kit";
import type { TestFile } from "@/lib/types";

const GRID = "lg:grid lg:grid-cols-[minmax(0,1fr)_190px_250px] lg:items-center lg:gap-6";

function splitPath(filePath: string): { dir: string; name: string } {
  const i = filePath.lastIndexOf("/");
  return i === -1 ? { dir: "", name: filePath } : { dir: filePath.slice(0, i + 1), name: filePath.slice(i + 1) };
}

function VersionsModal({ fileId, open, onClose }: { fileId: string; open: boolean; onClose: () => void }) {
  const { data: versions } = useQuery({ queryKey: ["test-file-versions", fileId], queryFn: () => api.getTestFileVersions(fileId), enabled: open });
  const [selected, setSelected] = useState<TestFile | null>(null);

  return (
    <Dialog open={open} onClose={onClose} title="Version history" description="Select a version to view its code" size="lg">
      <div className="-mx-6 max-h-[65vh] overflow-y-auto border-t border-border">
        {!versions && <SkeletonRows rows={3} />}
        <div className="divide-y divide-border">
          {versions?.map((v) => {
            const isOpen = selected?.id === v.id;
            return (
              <div key={v.id}>
                <button
                  type="button"
                  onClick={() => setSelected(isOpen ? null : v)}
                  className={cx("flex w-full items-center justify-between gap-3 px-6 py-3 text-sm transition-colors hover:bg-panel-2/40", isOpen && "bg-panel-2/40")}
                >
                  <span className="flex items-center gap-3">
                    <ChevronDown className={cx("h-4 w-4 text-muted transition-transform", !isOpen && "-rotate-90")} />
                    <span className="font-medium text-text">v{v.version}</span>
                    {v.isLatest && <Chip tone="primary">latest</Chip>}
                    <span className="text-muted">{timeAgo(v.createdAt)}</span>
                  </span>
                  <StatusPill status={v.status} />
                </button>
                {isOpen && (
                  <div className="px-6 pb-4">
                    <CodeViewer code={v.code} filename={`${v.filePath} · v${v.version}`} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Dialog>
  );
}

function FileRow({ file }: { file: TestFile }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [message, setMessage] = useState(`Add generated tests for: ${file.filePath}`);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["test-files"] });

  const approve = useMutation({ mutationFn: () => api.approveTestFile(file.id), onSuccess: invalidate });
  const regenerate = useMutation({ mutationFn: () => api.regenerateTestFile(file.id), onSuccess: invalidate });
  const commit = useMutation({
    mutationFn: () => api.commitTestFiles([file.id], message),
    onSuccess: () => {
      setCommitOpen(false);
      invalidate();
    },
  });
  // Same call + cache invalidation as Test History's "Run again".
  const run = useMutation({
    mutationFn: () => api.runTestFile(file.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["test-history"] });
      queryClient.invalidateQueries({ queryKey: ["test-runs", file.id] });
    },
  });
  const committed = file.status === "committed";

  const download = () => {
    const blob = new Blob([file.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filePath.split("/").pop() ?? "test.spec.ts";
    a.click();
    URL.revokeObjectURL(url);
  };

  const { dir, name } = splitPath(file.filePath);

  return (
    <div>
      <div className={cx(tableRowClass, GRID, "py-5", expanded && "bg-white/[0.02]")}>
        <div className="flex min-w-0 items-center gap-3.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FileCode2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <Link
              to={`/requirements/${file.requirementId}`}
              className="block truncate font-medium text-text transition-colors hover:text-primary"
              title={`${dir}${name} · v${file.version}`}
            >
              {name}
            </Link>
            {file.validationError && (
              <div className="mt-1 flex items-start gap-1.5 text-xs text-fail" title={file.validationError}>
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="line-clamp-1 break-words">{file.validationError}</span>
              </div>
            )}
          </div>
        </div>

        <div className="pl-[50px] lg:pl-0">
          <StatusPill status={file.status} />
        </div>

        <div className="flex items-center gap-1 pl-[42px] lg:justify-end lg:pl-0">
          {file.status === "syntax_valid" && (
            <TextAction tone="primary" icon={Check} onClick={() => approve.mutate()} disabled={approve.isPending}>
              Approve
            </TextAction>
          )}
          {file.status === "approved" && (
            <TextAction tone="primary" icon={GitCommitHorizontal} onClick={() => setCommitOpen(true)}>
              Commit
            </TextAction>
          )}
          <IconButton icon={Code2} label={expanded ? "Hide code" : "View code"} active={expanded} onClick={() => setExpanded((e) => !e)} />
          <IconButton
            icon={run.isPending ? LoaderCircle : Play}
            label={run.isPending ? "Running..." : "Run"}
            title={committed ? (run.isPending ? "Running..." : "Run this test file") : "Commit this test file before running it"}
            positive={committed}
            spinning={run.isPending}
            onClick={() => run.mutate()}
            disabled={!committed || run.isPending}
          />
          <ActionMenu
            items={[
              { label: regenerate.isPending ? "Regenerating..." : "Regenerate", icon: RefreshCw, onClick: () => regenerate.mutate(), disabled: regenerate.isPending },
              { label: "Compare versions", icon: GitCompare, onClick: () => setVersionsOpen(true) },
              { label: "Download", icon: Download, onClick: download },
            ]}
          />
        </div>
      </div>

      {expanded && (
        <div className="ws-rise bg-white/[0.02] px-6 pb-5">
          <CodeViewer code={file.code} filename={file.filePath} />
        </div>
      )}

      <VersionsModal fileId={file.id} open={versionsOpen} onClose={() => setVersionsOpen(false)} />
      <Dialog
        open={commitOpen}
        onClose={() => setCommitOpen(false)}
        title="Commit to Git"
        description={file.filePath}
        footer={
          <>
            <Btn variant="secondary" onClick={() => setCommitOpen(false)}>
              Cancel
            </Btn>
            <Btn variant="primary" onClick={() => commit.mutate()} disabled={!message.trim() || commit.isPending}>
              {commit.isPending ? "Committing..." : "Commit"}
            </Btn>
          </>
        }
      >
        <label className="mb-2 block text-sm font-medium text-text">Commit message</label>
        <input className={inputClass} value={message} onChange={(e) => setMessage(e.target.value)} />
      </Dialog>
    </div>
  );
}

export function TestFiles() {
  const { data, isLoading } = useQuery({ queryKey: ["test-files"], queryFn: () => api.listTestFiles() });
  const latestOnly = data?.filter((f) => f.isLatest);
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();
  const visible = q ? latestOnly?.filter((f) => f.filePath.toLowerCase().includes(q)) : latestOnly;
  const count = (pred: (f: TestFile) => boolean) => latestOnly?.filter(pred).length ?? "–";

  return (
    <PageShell>
      <PageHeader trail={["Execution", "Generated tests"]} title="Generated Tests" subtitle="Playwright TypeScript test files generated from approved scenarios" />

      <PageBody>
        {/* No overflow-hidden here: the row "more" menus must be able to drop below the last row. */}
        <Surface>
          <div className="flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text">Test files</h2>
              {visible && <Chip>{visible.length}</Chip>}
            </div>
            <TextInput icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by file name..." className="sm:w-80" />
          </div>

          <div className={cx(tableHeadClass, GRID)}>
            <span>Test file</span>
            <span>Status</span>
            <span className="text-right">Actions</span>
          </div>

          {isLoading && <SkeletonRows rows={4} />}

          <div className="divide-y divide-border">
            {visible?.map((f) => (
              <FileRow key={f.id} file={f} />
            ))}
          </div>

          {latestOnly?.length === 0 && (
            <EmptyState icon={FileCode2} title="No tests generated yet" description="Approve scenarios for generation and the Playwright Generator will produce test files here." />
          )}
          {latestOnly && latestOnly.length > 0 && visible?.length === 0 && (
            <EmptyState icon={Search} title="No matching files" description="No generated test file names match your search." />
          )}
          {visible && visible.length > 0 && (
            <TableFooter left={`${visible.length} / ${latestOnly?.length ?? 0} files`} right={`${count((f) => f.status === "committed")} committed`} />
          )}
        </Surface>
      </PageBody>
    </PageShell>
  );
}
