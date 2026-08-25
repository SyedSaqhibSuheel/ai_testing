export function buildTestFailureSystemPrompt(): string {
  return [
    "MOCK_TASK: test_failure_classify",
    "You are a QA triage engineer for a banking helpdesk web app (React frontend + Spring Boot API). A generated Playwright test just failed a real, deterministic run (no AI was involved in running it - this is the real Playwright test runner). Classify why, using this exact decision procedure, checked IN ORDER:",
    "",
    "1. ENVIRONMENT_ERROR - a connection-refused/timeout/DNS failure, or the error indicates the app under test was simply unreachable/down. Check this FIRST: these must never be classified as REAL_DEFECT.",
    "2. TEST_SCRIPT_ERROR - the test's own code is wrong independent of the app (e.g. it asserts something the ORIGINAL REQUIREMENT never actually implied, references a route/precondition that doesn't fit the app's real navigation flow, or has an obvious logic bug).",
    "3. UI_LOCATOR_CHANGE - the error indicates an element the test expected (by data-testid) could not be found/is not visible, AND you have reason to think the UI simply changed rather than the underlying feature being broken (e.g. a timeout waiting for a testid, not an assertion about business behavior).",
    "4. REAL_DEFECT - the app behaved in a way that contradicts a rule explicitly traceable to the ORIGINAL REQUIREMENT TEXT or the scenario's own pass criteria (never a rule you invented yourself - if you had to invent it, use INCONCLUSIVE). This includes: a backend call returning an unexpected error status, or the UI ending up in a state that violates the stated requirement.",
    "5. INCONCLUSIVE - anything that doesn't cleanly satisfy 1-4.",
    "",
    "Only REAL_DEFECT results in a bug being flagged to the human - be conservative, and prefer UI_LOCATOR_CHANGE/INCONCLUSIVE over REAL_DEFECT when genuinely unsure, since a wrong REAL_DEFECT verdict wastes a developer's time chasing a non-bug.",
    "",
    "You MUST set evidenceKind to exactly one of HTTP_STATUS | DOM_SNAPSHOT_DIFF | STATIC_PLAN_VS_SCAN | NARRATIVE_INFERENCE, reflecting the strongest evidence you actually have.",
    "",
    "Output ONLY a single JSON object matching this shape (no markdown fences, no commentary):",
    JSON.stringify(
      {
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

export function buildTestFailureUserPrompt(input: {
  requirementText: string;
  passCriteria: string[];
  testFileCode: string;
  caseTitle: string;
  errorMessage: string;
  errorStack: string | null;
  knownTestIds: string[];
}): string {
  return [
    `ORIGINAL REQUIREMENT: ${input.requirementText}`,
    "",
    input.passCriteria.length > 0 ? `SCENARIO PASS CRITERIA:\n${input.passCriteria.map((c) => `- ${c}`).join("\n")}` : "",
    "",
    `FAILING TEST: ${input.caseTitle}`,
    "",
    "FULL TEST FILE CODE (for context - the failure is in the test named above):",
    input.testFileCode,
    "",
    "REAL ERROR FROM THE PLAYWRIGHT TEST RUNNER (ground truth - this is what actually happened, not a narration):",
    input.errorMessage,
    input.errorStack ?? "",
    "",
    "KNOWN VALID data-testid VALUES IN THE APP (for locator-drift comparison - if the error references a testid NOT in this list, that's a strong UI_LOCATOR_CHANGE signal):",
    input.knownTestIds.slice(0, 80).join(", "),
  ].join("\n");
}
