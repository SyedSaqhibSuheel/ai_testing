/**
 * Enhanced HTTP Client with Dynamic URL Configuration
 *
 * This is an example of how to integrate the URL config system with your
 * existing API client. You can use this approach to make your HTTP requests
 * environment-aware.
 */

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

/**
 * Enhanced request function that uses the active URL configuration
 *
 * OPTION 1: Use server-side URL resolution (recommended for backend-heavy apps)
 * - Server resolves URLs based on active profile
 * - Endpoint is relative
 */
async function requestWithServerResolution<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Use the /api proxy (server handles URL resolution internally)
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

/**
 * OPTION 2: Use client-side URL resolution (recommended for external APIs)
 * - Frontend resolves URLs using the URL config service
 * - Useful if making direct calls to the app under test
 */
async function requestWithClientResolution<T>(
  endpoint: string,
  options?: RequestInit & { isAppUrl?: boolean }
): Promise<T> {
  const { isAppUrl, ...fetchOptions } = options || {};

  // Resolve the URL through the server's URL config service
  const resolveEndpoint = isAppUrl ? "/api/url-config/resolve-app" : "/api/url-config/resolve-api";
  const resolveRes = await fetch(resolveEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });

  if (!resolveRes.ok) {
    throw new Error("Failed to resolve URL");
  }

  const { resolvedUrl } = await resolveRes.json();

  // Make the actual request to the resolved URL
  const res = await fetch(resolvedUrl, {
    ...fetchOptions,
    headers: { "Content-Type": "application/json", ...fetchOptions?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/**
 * OPTION 3: Hybrid approach
 * - Use /api proxy for internal platform APIs
 * - Use client-side resolution for app-under-test APIs
 */
async function requestHybrid<T>(
  path: string,
  options?: RequestInit & { targetType?: "platform" | "app" }
): Promise<T> {
  const { targetType = "platform", ...fetchOptions } = options || {};

  if (targetType === "platform") {
    // Internal API - use proxy
    return requestWithServerResolution<T>(path, fetchOptions);
  } else {
    // External app - use client-side resolution
    return requestWithClientResolution<T>(path, { ...fetchOptions, isAppUrl: true });
  }
}

/**
 * OPTION 4: With caching and retry logic
 */
interface RequestCacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

const requestCache = new Map<string, RequestCacheEntry>();

async function requestWithCaching<T>(
  path: string,
  options?: RequestInit & { cacheTtl?: number; forceRefresh?: boolean }
): Promise<T> {
  const { cacheTtl = 5000, forceRefresh = false, ...fetchOptions } = options || {};

  // Check cache
  if (!forceRefresh) {
    const cached = requestCache.get(path);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data as T;
    }
  }

  // Make request
  const data = await requestWithServerResolution<T>(path, fetchOptions);

  // Cache result
  requestCache.set(path, {
    data,
    timestamp: Date.now(),
    ttl: cacheTtl,
  });

  return data;
}

/**
 * Current Actor Helper
 */
const currentActor = () => localStorage.getItem("actorEmail") || "unknown";

/**
 * API Client with URL Config Support
 * Use this as a drop-in replacement for your existing api client
 */
export const apiWithUrlConfig = {
  // ============================================
  // Requirements
  // ============================================
  listRequirements: () => requestWithServerResolution<Requirement[]>("/requirements"),
  getRequirement: (id: string) =>
    requestWithServerResolution<{
      requirement: Requirement;
      analysis: RequirementAnalysis | null;
      scenarios: Scenario[];
    }>(`/requirements/${id}`),
  createRequirement: (rawText: string, title?: string) =>
    requestWithServerResolution<Requirement>("/requirements", {
      method: "POST",
      body: JSON.stringify({ rawText, title, submittedBy: currentActor() }),
    }),
  analyzeRequirement: (id: string) =>
    requestWithServerResolution(`/requirements/${id}/analyze`, { method: "POST" }),
  planRequirement: (id: string) =>
    requestWithServerResolution(`/requirements/${id}/plan`, { method: "POST" }),
  generateRequirement: (id: string) =>
    requestWithServerResolution(`/requirements/${id}/generate`, { method: "POST" }),
  getExploration: (id: string) =>
    requestWithServerResolution<ExplorationRun>(`/requirements/${id}/exploration`).catch(
      () => null
    ),

  // ============================================
  // Scenarios
  // ============================================
  listScenarios: (params?: { requirementId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return requestWithServerResolution<Scenario[]>(
      `/scenarios${qs ? `?${qs}` : ""}`
    );
  },
  createScenario: (payload: Partial<Scenario> & { requirementId: string }) =>
    requestWithServerResolution<Scenario>("/scenarios", {
      method: "POST",
      body: JSON.stringify({ ...payload, actor: currentActor() }),
    }),
  updateScenario: (id: string, patch: Partial<Scenario>) =>
    requestWithServerResolution<Scenario>(`/scenarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...patch, actor: currentActor() }),
    }),
  approveScenario: (id: string) =>
    requestWithServerResolution<Scenario>(`/scenarios/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ actor: currentActor() }),
    }),
  rejectScenario: (id: string, reason: string) =>
    requestWithServerResolution<Scenario>(`/scenarios/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ actor: currentActor(), reason }),
    }),
  regenerateScenario: (id: string, feedback?: string) =>
    requestWithServerResolution<Scenario>(`/scenarios/${id}/regenerate`, {
      method: "POST",
      body: JSON.stringify({ actor: currentActor(), feedback }),
    }),
  deleteScenario: (id: string) =>
    requestWithServerResolution(`/scenarios/${id}?actor=${encodeURIComponent(currentActor())}`, {
      method: "DELETE",
    }),

  // ============================================
  // Test Files
  // ============================================
  listTestFiles: (requirementId?: string) =>
    requestWithServerResolution<TestFile[]>(
      `/test-files${requirementId ? `?requirementId=${requirementId}` : ""}`
    ),
  getTestFile: (id: string) =>
    requestWithServerResolution<{ file: TestFile; mapping: TestFileScenarioMapping[] }>(
      `/test-files/${id}`
    ),
  getTestFileVersions: (id: string) =>
    requestWithServerResolution<TestFile[]>(`/test-files/${id}/versions`),
  approveTestFile: (id: string) =>
    requestWithServerResolution<TestFile>(`/test-files/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ actor: currentActor() }),
    }),
  rejectTestFile: (id: string, reason: string) =>
    requestWithServerResolution<TestFile>(`/test-files/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ actor: currentActor(), reason }),
    }),
  regenerateTestFile: (id: string) =>
    requestWithServerResolution<TestFile>(`/test-files/${id}/regenerate`, {
      method: "POST",
    }),

  // ============================================
  // Git
  // ============================================
  getGitStatus: () =>
    requestWithServerResolution<{
      dir: string;
      branch: string;
      changedFiles: string[];
      isClean: boolean;
    }>("/git/status"),
  getGitCommits: () =>
    requestWithServerResolution<{ commits: GitCommitRecord[]; rawLog: unknown[] }>(
      "/git/commits"
    ),
  commitTestFiles: (testFileIds: string[], message: string) =>
    requestWithServerResolution<{ commitSha: string; filesChanged: string[] }>(
      "/git/commit",
      {
        method: "POST",
        body: JSON.stringify({ testFileIds, message, author: currentActor() }),
      }
    ),

  // ============================================
  // Agent Runs
  // ============================================
  listAgentRuns: (params?: { agentType?: string; requirementId?: string; status?: string }) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return requestWithServerResolution<AgentRun[]>(
      `/agent-runs${qs ? `?${qs}` : ""}`
    );
  },

  // ============================================
  // Settings
  // ============================================
  getSettings: () => requestWithServerResolution<MaskedSettings>("/settings"),
  updateSettings: (patch: Partial<MaskedSettings>) =>
    requestWithServerResolution<MaskedSettings>("/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  // ============================================
  // Dashboard
  // ============================================
  getDashboardSummary: () =>
    requestWithServerResolution<DashboardSummary>("/dashboard/summary"),
};

/**
 * Usage examples:
 *
 * // Replace old import
 * import { api } from '@/lib/api';
 * // With new one:
 * import { apiWithUrlConfig as api } from '@/lib/apiWithUrlConfig';
 *
 * // All calls now respect the active URL configuration
 * const requirements = await api.listRequirements();
 * // Automatically uses the active profile's URLs
 *
 * // To make external app-under-test calls:
 * const response = await requestWithClientResolution(
 *   '/api/users',
 *   { method: 'GET', isAppUrl: true }
 * );
 * // Resolves through URL config service and calls the app under test
 *
 * // For direct app URLs without going through URL config:
 * const appResponse = await fetch(
 *   `${config.appBaseUrl}/users`,
 *   { method: 'GET' }
 * );
 */
