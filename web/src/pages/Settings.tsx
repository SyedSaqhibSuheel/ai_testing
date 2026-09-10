import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/PageHeader";
import type { ApprovalMode } from "@/lib/types";

const MODES: { value: ApprovalMode; label: string; description: string }[] = [
  { value: "manual", label: "Manual", description: "Every gate (scenario intent, grounded plan, generated code, commit) requires a human click." },
  {
    value: "semi_automatic",
    label: "Semi-Automatic",
    description: "Scenario intent and grounded plan stay human-reviewed. Generated code and commits auto-approve once they pass syntax/locator validation.",
  },
  { value: "fully_automatic", label: "Fully Automatic", description: "Every gate auto-approves on success. Failures never auto-advance in any mode." },
];

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

  if (!settings) return <div className="p-8 text-sm text-muted">Loading...</div>;

  return (
    <div>
      <PageHeader title="Settings" subtitle="Platform configuration - secrets are never shown here, only whether they're set" />
      <div className="p-8 space-y-8 max-w-2xl">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Your identity</h2>
          <Card className="p-4">
            <label className="text-xs text-muted block mb-1.5">Email (used to attribute approvals/rejections you make)</label>
            <input
              className="w-full bg-panel-2 border border-border rounded-md px-3 py-2 text-sm"
              value={actorEmail}
              onChange={(e) => setActorEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </Card>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Approval mode</h2>
          <div className="space-y-2">
            {MODES.map((m) => (
              <Card
                key={m.value}
                className={`p-4 cursor-pointer transition-colors ${
                  settings.approvalMode === m.value ? "border-accent" : "hover:border-border-hover"
                }`}
                onClick={() => updateMode.mutate(m.value)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                      settings.approvalMode === m.value ? "border-accent bg-accent" : "border-border"
                    }`}
                  />
                  <span className="text-sm font-medium">{m.label}</span>
                </div>
                <p className="text-xs text-muted mt-1.5 ml-5.5">{m.description}</p>
              </Card>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">AI provider</h2>
          <Card className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Active provider</span>
              <span className="capitalize">{settings.llmProvider}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Anthropic key</span>
              <span className={settings.secretsPresent.anthropicApiKey ? "text-pass" : "text-muted"}>
                {settings.secretsPresent.anthropicApiKey ? "Configured" : "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">OpenAI key</span>
              <span className={settings.secretsPresent.openaiApiKey ? "text-pass" : "text-muted"}>
                {settings.secretsPresent.openaiApiKey ? "Configured" : "Not set"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Gemini key</span>
              <span className={settings.secretsPresent.geminiApiKey ? "text-pass" : "text-muted"}>
                {settings.secretsPresent.geminiApiKey ? "Configured" : "Not set"}
              </span>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Agent execution</h2>
          <Card className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Max retries</span>
              <span>{settings.maxRetries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Agent timeout</span>
              <span>{settings.agentTimeoutMs / 1000}s</span>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Repository</h2>
          <Card className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Managed repo</span>
              <span className="mono text-xs">{settings.managedRepoDir}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Branch</span>
              <span>{settings.managedRepoBranch}</span>
            </div>
          </Card>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">Application under test</h2>
          <Card className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">App URL</span>
              <span className="mono text-xs">{settings.appBaseUrl}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">API URL</span>
              <span className="mono text-xs">{settings.apiBaseUrl}</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
