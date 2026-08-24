import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/PageHeader";
import type { TestFile } from "@/lib/types";

function VersionsModal({ fileId, open, onClose }: { fileId: string; open: boolean; onClose: () => void }) {
  const { data: versions } = useQuery({ queryKey: ["test-file-versions", fileId], queryFn: () => api.getTestFileVersions(fileId), enabled: open });
  const [selected, setSelected] = useState<TestFile | null>(null);

  return (
    <Modal open={open} onClose={onClose} title="Version history">
      <div className="space-y-2 max-h-[70vh] overflow-y-auto">
        {versions?.map((v) => (
          <div key={v.id}>
            <button
              onClick={() => setSelected(selected?.id === v.id ? null : v)}
              className="w-full flex items-center justify-between p-2.5 rounded-md hover:bg-panel-2 text-sm"
            >
              <span>
                v{v.version} {v.isLatest && <span className="text-accent">(latest)</span>}
              </span>
              <StatusBadge status={v.status} />
            </button>
            {selected?.id === v.id && (
              <pre className="mono text-xs bg-black/40 border border-border rounded-md p-3 mt-1 overflow-x-auto max-h-64">{v.code}</pre>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
}

function FileCard({ file }: { file: TestFile }) {
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

  const download = () => {
    const blob = new Blob([file.code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filePath.split("/").pop() ?? "test.spec.ts";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <Link to={`/requirements/${file.requirementId}`} className="text-sm mono hover:text-accent">
            {file.filePath}
          </Link>
          <span className="text-xs text-muted ml-2">v{file.version}</span>
        </div>
        <StatusBadge status={file.status} />
      </div>
      {file.validationError && <div className="text-xs text-fail">{file.validationError}</div>}
      <button onClick={() => setExpanded((e) => !e)} className="text-xs text-accent">
        {expanded ? "Hide code" : "View code"}
      </button>
      {expanded && <pre className="mono text-xs bg-black/40 border border-border rounded-md p-3 overflow-x-auto max-h-96">{file.code}</pre>}
      <div className="flex flex-wrap gap-2 pt-1">
        {file.status === "syntax_valid" && (
          <Button onClick={() => approve.mutate()} disabled={approve.isPending}>
            Approve
          </Button>
        )}
        {file.status === "approved" && <Button onClick={() => setCommitOpen(true)}>Commit to Git</Button>}
        <Button variant="secondary" onClick={() => regenerate.mutate()} disabled={regenerate.isPending}>
          Regenerate
        </Button>
        <Button variant="secondary" onClick={() => setVersionsOpen(true)}>
          Compare versions
        </Button>
        <Button variant="ghost" onClick={download}>
          Download
        </Button>
      </div>
      <VersionsModal fileId={file.id} open={versionsOpen} onClose={() => setVersionsOpen(false)} />
      <Modal open={commitOpen} onClose={() => setCommitOpen(false)} title="Commit to Git">
        <input
          className="w-full bg-panel-2 border border-border rounded-md px-3 py-2 text-sm mb-3"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCommitOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => commit.mutate()} disabled={!message.trim() || commit.isPending}>
            {commit.isPending ? "Committing..." : "Commit"}
          </Button>
        </div>
      </Modal>
    </Card>
  );
}

export function TestFiles() {
  const { data } = useQuery({ queryKey: ["test-files"], queryFn: () => api.listTestFiles() });
  const latestOnly = data?.filter((f) => f.isLatest);

  return (
    <div>
      <PageHeader title="Generated Tests" subtitle="Playwright TypeScript test files generated from approved scenarios" />
      <div className="p-8 space-y-3">
        {latestOnly?.map((f) => (
          <FileCard key={f.id} file={f} />
        ))}
        {latestOnly?.length === 0 && <div className="text-sm text-muted">No tests generated yet.</div>}
      </div>
    </div>
  );
}
