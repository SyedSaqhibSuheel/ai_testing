import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, GitBranch, Hand, LoaderCircle, Mail, SlidersHorizontal, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { URLConfigPanel } from "@/components/URLConfigPanel";
import { Chip, Field, StatusGlyph, labelClass, LoadingState, PageBody, PageHeader, PageShell, Surface, SurfaceHeader, TextInput, cx } from "@/components/workspace/kit";
import type { ApprovalMode } from "@/lib/types";

const MODES: { value: ApprovalMode; label: string; description: string; icon: LucideIcon }[] = [
  { value: "manual", label: "Manual", icon: Hand, description: "Every gate (scenario intent, grounded plan, generated code, commit) requires a human click." },
  {
    value: "semi_automatic",
    label: "Semi-Automatic",
    icon: SlidersHorizontal,
    description: "Scenario intent and grounded plan stay human-reviewed. Generated code and commits auto-approve once they pass syntax/locator validation.",
  },
  { value: "fully_automatic", label: "Fully Automatic", icon: Zap, description: "Every gate auto-approves on success. Failures never auto-advance in any mode." },
];

function SettingsCard({ index, title, description, children, className }: { index: number; title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <Surface className={cx("flex flex-col overflow-hidden", className)}>
      <SurfaceHeader eyebrow={`${String(index).padStart(2, "0")} / 06`} title={title} description={description} />
      <div className="flex-1 p-6">{children}</div>
    </Surface>
  );
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const [actorEmail, setActorEmail] = useState(() => localStorage.getItem("actorEmail") ?? "");

  useEffect(() => {
    localStorage.setItem("actorEmail", actorEmail);
  }, [actorEmail]);

  const updateMode = useMutation({
    mutationFn: (approvalMode: ApprovalMode) => api.updateSettings({ approvalMode }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["settings"] }),
  });

  if (!settings) {
    return (
      <PageShell>
        <PageHeader trail={["Configuration", "Settings"]} title="Settings" />
        <PageBody>
          <LoadingState />
        </PageBody>
      </PageShell>
    );
  }

  const providers = [
    { id: "anthropic", label: "Anthropic", configured: settings.secretsPresent.anthropicApiKey },
    { id: "openai", label: "OpenAI", configured: settings.secretsPresent.openaiApiKey },
    { id: "gemini", label: "Gemini", configured: settings.secretsPresent.geminiApiKey },
  ];

  return (
    <PageShell>
      <PageHeader trail={["Configuration", "Settings"]} title="Settings" subtitle="Platform configuration - secrets are never shown here, only whether they're set" />

      <PageBody>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SettingsCard index={1} title="Your identity" description="Attributes approvals and rejections you make. Stored in this browser only.">
            <label className="mb-2 block text-sm font-medium text-text">Email (used to attribute approvals/rejections you make)</label>
            <TextInput icon={Mail} value={actorEmail} onChange={(e) => setActorEmail(e.target.value)} placeholder="you@example.com" />
          </SettingsCard>

          <SettingsCard index={2} title="AI provider" description="Which provider powers the agents, and which API keys are present.">
            <ul className="-my-3 divide-y divide-border">
              {providers.map((p) => {
                const inUse = settings.llmProvider.toLowerCase() === p.id;
                return (
                  <li key={p.id} className="flex items-center justify-between gap-4 py-3">
                    <span className="flex items-center gap-2 text-sm text-text">
                      {p.label}
                      {inUse && <Chip tone="primary">Active</Chip>}
                    </span>
                    <span className={cx("mono inline-flex items-center gap-2 text-[10.5px] font-medium uppercase tracking-[0.14em]", p.configured ? "text-pass" : "text-muted")}>
                      <StatusGlyph tone={p.configured ? "pass" : "neutral"} />
                      {p.configured ? "Configured" : "Not set"}
                    </span>
                  </li>
                );
              })}
            </ul>
            {!providers.some((p) => p.id === settings.llmProvider.toLowerCase()) && (
              <div className="mt-4 text-sm text-muted">
                Active provider: <span className="capitalize text-text">{settings.llmProvider}</span>
              </div>
            )}
          </SettingsCard>

          <SettingsCard index={3} title="Approval mode" description="Choose how much of the pipeline runs without a human in the loop." className="lg:col-span-2">
            <div role="radiogroup" aria-label="Approval mode" className="grid gap-4 md:grid-cols-3">
              {MODES.map((m) => {
                const selected = settings.approvalMode === m.value;
                const saving = updateMode.isPending && updateMode.variables === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => updateMode.mutate(m.value)}
                    className={cx(
                      "group flex flex-col rounded-xl border p-5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                      selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/40 hover:bg-panel-2/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className={cx("flex h-9 w-9 items-center justify-center rounded-lg transition-colors", selected ? "bg-primary/15 text-primary" : "bg-panel-2 text-muted group-hover:text-text")}>
                        <m.icon className="h-4 w-4" />
                      </span>
                      <span
                        className={cx(
                          "flex h-5 w-5 items-center justify-center rounded-full border transition-colors",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-border",
                        )}
                      >
                        {saving ? <LoaderCircle className="h-3 w-3 animate-spin" /> : selected && <Check className="h-3 w-3" />}
                      </span>
                    </div>
                    <span className={cx(labelClass, "mt-5")}>Mode {String(MODES.indexOf(m) + 1).padStart(2, "0")}</span>
                    <span className="mt-1 text-sm font-semibold text-text">{m.label}</span>
                    <p className="mt-1 text-sm leading-relaxed text-muted">{m.description}</p>
                  </button>
                );
              })}
            </div>
          </SettingsCard>

          <SettingsCard index={4} title="Agent execution" description="Limits applied to every agent run.">
            <dl className="grid grid-cols-2 gap-6">
              <Field label="Max retries">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{settings.maxRetries}</span>
              </Field>
              <Field label="Agent timeout">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{settings.agentTimeoutMs / 1000}s</span>
              </Field>
            </dl>
          </SettingsCard>

          <SettingsCard index={5} title="Repository" description="Where generated tests are committed.">
            <dl className="space-y-5">
              <Field label="Managed repo">
                <span className="mono break-all">{settings.managedRepoDir}</span>
              </Field>
              <Field label="Branch">
                <span className="mono inline-flex items-center gap-1.5">
                  <GitBranch className="h-3.5 w-3.5 text-muted" />
                  {settings.managedRepoBranch}
                </span>
              </Field>
            </dl>
          </SettingsCard>

          <SettingsCard index={6} title="Environment configuration" description="Add and switch between the URLs available for testing." className="lg:col-span-2">
            <URLConfigPanel />
          </SettingsCard>
        </div>
      </PageBody>
    </PageShell>
  );
}
