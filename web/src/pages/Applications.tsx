import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/PageHeader";
import type { Application, ApplicationInput } from "@/lib/types";

const EMPTY_FORM: ApplicationInput = {
  name: "",
  description: "",
  appBaseUrl: "",
  apiBaseUrl: "",
  backendSrcDir: "",
  frontendSrcDir: "",
  frontendServerSrcDir: "",
  loginUsername: "",
  loginPassword: "",
  loginUsernameLocator: "",
  loginPasswordLocator: "",
  loginSubmitLocator: "",
};

function Field({ label, hint, value, onChange, type = "text", placeholder }: { label: string; hint?: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs text-muted block mb-1">{label}</label>
      <input
        type={type}
        className="w-full bg-panel-2 border border-border rounded-md px-3 py-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p className="text-[11px] text-muted mt-1">{hint}</p>}
    </div>
  );
}

function ApplicationForm({ form, setForm }: { form: ApplicationInput; setForm: (f: ApplicationInput) => void }) {
  const set = (key: keyof ApplicationInput) => (v: string) => setForm({ ...form, [key]: v });
  return (
    <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
      <Field label="Name" value={form.name} onChange={set("name")} placeholder="e.g. My Shop Admin" />
      <Field label="Description" value={form.description ?? ""} onChange={set("description")} placeholder="One line - shown to the AI as context" />

      <div className="pt-2 border-t border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 mt-2">Where to test</h4>
        <div className="space-y-3">
          <Field label="App base URL" value={form.appBaseUrl ?? ""} onChange={set("appBaseUrl")} placeholder="http://localhost:3000" />
          <Field label="API base URL (optional)" value={form.apiBaseUrl ?? ""} onChange={set("apiBaseUrl")} placeholder="http://localhost:3000/api" />
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 mt-2">Source code (optional)</h4>
        <p className="text-[11px] text-muted mb-2">
          Leave these blank for an app with no local source (or a stack this platform has no scanner for, e.g. Vue/Angular/.NET) -
          Code Analysis is skipped and everything is learned by live browser exploration instead.
        </p>
        <div className="space-y-3">
          <Field label="Frontend source dir" value={form.frontendSrcDir ?? ""} onChange={set("frontendSrcDir")} placeholder="../my-app/client/src" />
          <Field label="Backend source dir" value={form.backendSrcDir ?? ""} onChange={set("backendSrcDir")} placeholder="../my-app-backend/src/main/java" />
          <Field label="Frontend's own server dir" value={form.frontendServerSrcDir ?? ""} onChange={set("frontendServerSrcDir")} placeholder="../my-app/server" />
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2 mt-2">Login (optional)</h4>
        <div className="space-y-3">
          <Field label="Username" value={form.loginUsername ?? ""} onChange={set("loginUsername")} />
          <Field label="Password" type="password" value={form.loginPassword ?? ""} onChange={set("loginPassword")} placeholder="Leave blank to keep the current one" />
          <Field label="Username field locator" value={form.loginUsernameLocator ?? ""} onChange={set("loginUsernameLocator")} placeholder="page.getByTestId('input-username')" />
          <Field label="Password field locator" value={form.loginPasswordLocator ?? ""} onChange={set("loginPasswordLocator")} placeholder="page.getByTestId('input-password')" />
          <Field label="Submit locator" value={form.loginSubmitLocator ?? ""} onChange={set("loginSubmitLocator")} placeholder="page.getByTestId('button-sign-in')" />
        </div>
      </div>
    </div>
  );
}

export function Applications() {
  const queryClient = useQueryClient();
  const { data: applications, isLoading } = useQuery({ queryKey: ["applications"], queryFn: api.listApplications });
  const { data: active } = useQuery({ queryKey: ["active-application"], queryFn: api.getActiveApplication });

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Application | null>(null);
  const [form, setForm] = useState<ApplicationInput>(EMPTY_FORM);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["applications"] });
    queryClient.invalidateQueries({ queryKey: ["active-application"] });
  };

  const create = useMutation({
    mutationFn: () => api.createApplication(form),
    onSuccess: () => {
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      invalidate();
    },
  });

  const update = useMutation({
    mutationFn: () => api.updateApplication(editing!.id, form),
    onSuccess: () => {
      setEditing(null);
      invalidate();
    },
  });

  const activate = useMutation({
    mutationFn: (id: string) => api.activateApplication(id),
    onSuccess: invalidate,
  });

  const openEdit = (app: Application) => {
    setForm({
      name: app.name,
      description: app.description ?? "",
      appBaseUrl: app.appBaseUrl ?? "",
      apiBaseUrl: app.apiBaseUrl ?? "",
      backendSrcDir: app.backendSrcDir ?? "",
      frontendSrcDir: app.frontendSrcDir ?? "",
      frontendServerSrcDir: app.frontendServerSrcDir ?? "",
      loginUsername: app.loginUsername ?? "",
      loginPassword: "",
      loginUsernameLocator: app.loginUsernameLocator ?? "",
      loginPasswordLocator: app.loginPasswordLocator ?? "",
      loginSubmitLocator: app.loginSubmitLocator ?? "",
    });
    setEditing(app);
  };

  const activeId = active?.application?.id;

  return (
    <div>
      <PageHeader
        title="Applications"
        subtitle="Point this platform at whatever app you want to test - one active at a time. Switching applies to Code Analysis, the Planner, test generation, and every run."
        actions={
          <Button
            onClick={() => {
              setForm(EMPTY_FORM);
              setCreateOpen(true);
            }}
          >
            Add Application
          </Button>
        }
      />

      <div className="p-8 space-y-4">
        {active?.application && (
          <Card className="p-4 text-sm">
            <span className="text-muted">Active: </span>
            <span className="font-medium">{active.application.name}</span>
            <span className="text-muted ml-2">
              {active.hasSourceAccess ? "· source code available (Code Analysis enabled)" : "· no source code configured - live browser exploration only"}
            </span>
          </Card>
        )}

        {isLoading && (
          <Card className="p-6 text-center text-sm text-muted">Loading applications...</Card>
        )}

        {!isLoading && applications?.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted">
            No applications yet - click "Add Application" to point this platform at something to test.
          </Card>
        )}

        <div className="space-y-2">
          {applications?.map((app) => (
            <Card key={app.id} className={`p-4 flex items-center justify-between gap-4 ${app.id === activeId ? "border-accent" : ""}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{app.name}</span>
                  {app.id === activeId && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">Active</span>
                  )}
                </div>
                {app.description && <p className="text-xs text-muted mt-0.5">{app.description}</p>}
                <p className="text-xs text-muted mt-1 mono truncate">{app.appBaseUrl || "(no base URL set)"}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                {app.id !== activeId && (
                  <Button variant="secondary" onClick={() => activate.mutate(app.id)} disabled={activate.isPending}>
                    Activate
                  </Button>
                )}
                <Button variant="secondary" onClick={() => openEdit(app)}>
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add Application">
        <ApplicationForm form={form} setForm={setForm} />
        {create.isError && <p className="text-xs text-fail mt-3">{(create.error as Error).message}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => create.mutate()} disabled={!form.name.trim() || create.isPending}>
            {create.isPending ? "Creating..." : "Create"}
          </Button>
        </div>
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Edit ${editing?.name ?? ""}`}>
        <ApplicationForm form={form} setForm={setForm} />
        {update.isError && <p className="text-xs text-fail mt-3">{(update.error as Error).message}</p>}
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="secondary" onClick={() => setEditing(null)}>
            Cancel
          </Button>
          <Button onClick={() => update.mutate()} disabled={!form.name.trim() || update.isPending}>
            {update.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
