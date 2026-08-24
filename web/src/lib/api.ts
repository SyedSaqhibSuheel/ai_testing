import { QueryClient } from "@tanstack/react-query";
import type {
  AgentRun,
  DashboardSummary,
  ExplorationRun,
  GitCommitRecord,
  MaskedSettings,
  Requirement,
  RequirementAnalysis,
  Scenario,
  TestFile,
  TestFileScenarioMapping,
} from "./types";

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, retry: false } },
});

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

const currentActor = () => localStorage.getItem("actorEmail") || "unknown";

export const api = {
  // Requirements
  listRequirements: () => request<Requirement[]>("/requirements"),
  getRequirement: (id: string) =>
    request<{ requirement: Requirement; analysis: RequirementAnalysis | null; scenarios: Scenario[] }>(`/requirements/${id}`),
  createRequirement: (rawText: string, title?: string) =>
    request<Requirement>("/requirements", { method: "POST", body: JSON.stringify({ rawText, title, submittedBy: currentActor() }) }),
  analyzeRequirement: (id: string) => request(`/requirements/${id}/analyze`, { method: "POST" }),
  planRequirement: (id: string) => request(`/requirements/${id}/plan`, { method: "POST" }),
  generateRequirement: (id: string) => request(`/requirements/${id}/generate`, { method: "POST" }),
  getExploration: (id: string) => request<ExplorationRun>(`/requirements/${id}/exploration`).catch(() => null),

  // Scenarios
  listScenarios: (params?: { requirementId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<Scenario[]>(`/scenarios${qs ? `?${qs}` : ""}`);
  },
  createScenario: (payload: Partial<Scenario> & { requirementId: string }) =>
    request<Scenario>("/scenarios", { method: "POST", body: JSON.stringify({ ...payload, actor: currentActor() }) }),
  updateScenario: (id: string, patch: Partial<Scenario>) =>
    request<Scenario>(`/scenarios/${id}`, { method: "PATCH", body: JSON.stringify({ ...patch, actor: currentActor() }) }),
  approveScenario: (id: string) => request<Scenario>(`/scenarios/${id}/approve`, { method: "POST", body: JSON.stringify({ actor: currentActor() }) }),
  rejectScenario: (id: string, reason: string) =>
    request<Scenario>(`/scenarios/${id}/reject`, { method: "POST", body: JSON.stringify({ actor: currentActor(), reason }) }),
  regenerateScenario: (id: string, feedback?: string) =>
    request<Scenario>(`/scenarios/${id}/regenerate`, { method: "POST", body: JSON.stringify({ actor: currentActor(), feedback }) }),
  deleteScenario: (id: string) => request(`/scenarios/${id}?actor=${encodeURIComponent(currentActor())}`, { method: "DELETE" }),

  // Test files
  listTestFiles: (requirementId?: string) => request<TestFile[]>(`/test-files${requirementId ? `?requirementId=${requirementId}` : ""}`),
  getTestFile: (id: string) => request<{ file: TestFile; mapping: TestFileScenarioMapping[] }>(`/test-files/${id}`),
  getTestFileVersions: (id: string) => request<TestFile[]>(`/test-files/${id}/versions`),
  approveTestFile: (id: string) => request<TestFile>(`/test-files/${id}/approve`, { method: "POST", body: JSON.stringify({ actor: currentActor() }) }),
  rejectTestFile: (id: string, reason: string) =>
    request<TestFile>(`/test-files/${id}/reject`, { method: "POST", body: JSON.stringify({ actor: currentActor(), reason }) }),
  regenerateTestFile: (id: string) => request<TestFile>(`/test-files/${id}/regenerate`, { method: "POST" }),

  // Git
  getGitStatus: () => request<{ dir: string; branch: string; changedFiles: string[]; isClean: boolean }>("/git/status"),
  getGitCommits: () => request<{ commits: GitCommitRecord[]; rawLog: unknown[] }>("/git/commits"),
  commitTestFiles: (testFileIds: string[], message: string) =>
    request<{ commitSha: string; filesChanged: string[] }>("/git/commit", {
      method: "POST",
      body: JSON.stringify({ testFileIds, message, author: currentActor() }),
    }),

  // Agent runs
  listAgentRuns: (params?: { agentType?: string; requirementId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<AgentRun[]>(`/agent-runs${qs ? `?${qs}` : ""}`);
  },

  // Settings
  getSettings: () => request<MaskedSettings>("/settings"),
  updateSettings: (patch: Partial<MaskedSettings>) => request<MaskedSettings>("/settings", { method: "PATCH", body: JSON.stringify(patch) }),

  // Dashboard
  getDashboardSummary: () => request<DashboardSummary>("/dashboard/summary"),
};
