import type { RelevantContext } from "../context/selectRelevantContext.js";
import type { Scenario } from "../schemas/testPlan.js";
import type { ScenarioResult, TranscriptTurn } from "../schemas/scenarioResult.js";

export function buildClassifierSystemPrompt(): string {
  return [
    "MOCK_TASK: classify",
    "You are a QA triage engineer. A test scenario against a banking helpdesk web app (React frontend + Spring Boot API) did not cleanly pass. Classify why, using this exact decision procedure, checked IN ORDER:",
    "",
    "IMPORTANT: the RESULT.summary/stepOutcomes below are the model-under-test's own self-report - it can be wrong or claim things it never actually observed (e.g. asserting a specific endpoint/status that never appears in the real NETWORK LOG). Base your classification on the NETWORK LOG and TRANSCRIPT TAIL (both captured directly from the browser), not on unverified claims in RESULT.summary.",
    "",
    "1. ENVIRONMENT_ERROR - a connection-refused/timeout/DNS failure, an MCP tool error that occurred before any HTTP response was observed, or a browser crash. Check this FIRST: these produce no HTTP status and must never be classified as REAL_DEFECT.",
    "2. TEST_SCRIPT_ERROR - the scenario's own steps are internally inconsistent, or reference a route/testid/precondition that does not exist per the provided scan (this should usually have been caught before execution, but confirm here if it slipped through).",
    "3. UI_LOCATOR_CHANGE - an expected element/testid was absent from the live accessibility snapshot, AND a similarly-named element exists in the current frontend scan under a different testid or label (real string-similarity, not just 'feels related'). If you can't point to a specific similar element in the scan, do NOT use this bucket.",
    "4. REAL_DEFECT - the backend returned 4xx/5xx on a request that was validly formed per the scan, OR all backend calls returned 2xx but the resulting UI state contradicts a rule that is explicitly traceable to the ORIGINAL REQUIREMENT TEXT or the scenario's own passCriteria (never a rule you inferred yourself - if you had to infer the rule, use INCONCLUSIVE instead).",
    "5. INCONCLUSIVE - anything that doesn't cleanly satisfy 1-4, including timeouts/turn-cap exits and unverified-rule contradictions.",
    "",
    "You MUST set evidenceKind to exactly one of HTTP_STATUS | DOM_SNAPSHOT_DIFF | STATIC_PLAN_VS_SCAN | NARRATIVE_INFERENCE, reflecting the strongest evidence you actually have (prefer hard evidence over narrative inference).",
    "",
    "Output ONLY a single JSON object matching this shape (no markdown fences, no commentary):",
    JSON.stringify(
      {
        scenarioId: "string",
        classification: "ENVIRONMENT_ERROR | TEST_SCRIPT_ERROR | UI_LOCATOR_CHANGE | REAL_DEFECT | INCONCLUSIVE",
        confidence: 0.0,
        evidenceKind: "HTTP_STATUS | DOM_SNAPSHOT_DIFF | STATIC_PLAN_VS_SCAN | NARRATIVE_INFERENCE",
        evidence: ["string"],
        reasoning: "string",
        suggestedFix: "string (optional)",
      },
      null,
      2
    ),
  ].join("\n");
}

export function buildClassifierUserPrompt(
  requirement: string,
  scenario: Scenario,
  result: ScenarioResult,
  transcript: TranscriptTurn[],
  context: RelevantContext
): string {
  const transcriptTail = transcript.slice(-30);
  return [
    `ORIGINAL REQUIREMENT: ${requirement}`,
    "",
    `SCENARIO: ${JSON.stringify(scenario, null, 2)}`,
    "",
    `RESULT (self-reported by the model under test - narration, NOT verified evidence; only trust claims here that the NETWORK LOG or TRANSCRIPT below actually corroborate): ${JSON.stringify({ scenarioId: result.scenarioId, status: result.status, summary: result.summary, stepOutcomes: result.stepOutcomes, failingStepIndex: result.failingStepIndex }, null, 2)}`,
    "",
    "TRANSCRIPT TAIL (most recent turns - ground truth: real tool calls and their real results):",
    JSON.stringify(transcriptTail, null, 2),
    "",
    "FINAL ACCESSIBILITY SNAPSHOT (ground truth, captured directly from the browser):",
    result.finalSnapshotText ?? "(none captured)",
    "",
    "NETWORK LOG (ground truth, captured directly from the browser via browser_network_requests - this is authoritative; if RESULT.summary claims a network call/status that doesn't appear here, treat that claim as unverified narration, not fact):",
    JSON.stringify(result.networkLog, null, 2),
    "",
    "RELEVANT SCANNED FRONTEND TESTIDS (for locator-drift comparison):",
    context.components.map((c) => `- ${c.componentName ?? c.file}: [${c.testIds.join(", ")}]`).join("\n") || "(none)",
    "",
    "RELEVANT SCANNED BACKEND ENDPOINTS (for validity comparison):",
    context.controllers
      .flatMap((c) => c.endpoints.map((e) => `- ${e.httpMethod} ${e.path}`))
      .join("\n") || "(none)",
  ].join("\n");
}
