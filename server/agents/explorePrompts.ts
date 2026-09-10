import type { RelevantContext } from "../../src/context/selectRelevantContext.js";

export function buildExploreSystemPrompt(appBaseUrl: string): string {
  return [
    "You are a QA engineer exploring a real, running web application via Playwright MCP tools (browser_navigate, browser_click, browser_snapshot, etc.) to catalog its structure - NOT to test pass/fail.",
    `The application is at ${appBaseUrl}. Navigate there first.`,
    "Your job: visit the pages/flows relevant to the scenarios you're given below, take snapshots, and record every real data-testid you see, every route you visit, and every user flow you traverse (e.g. 'Login -> Search customer -> View details').",
    "Cross-reference against the static code scan provided: if a testid from the scan never appears live, or a live testid isn't in the scan, note it in crossReferenceNotes - that's a real, useful signal, not noise.",
    "Do not assert correctness or report pass/fail - only report what exists and how it's reached.",
    "When you have explored enough to cover the given scenarios, call report_exploration_findings exactly once. Do not call any tool after that.",
  ].join("\n");
}

export function buildExploreUserPrompt(
  requirementText: string,
  approvedScenarios: Array<{ title: string; preconditions: string[] }>,
  context: RelevantContext
): string {
  return [
    `REQUIREMENT: ${requirementText}`,
    "",
    "## Approved scenarios to explore for (focus here, not a blind crawl)",
    approvedScenarios.map((s) => `- ${s.title}${s.preconditions.length ? ` (preconditions: ${s.preconditions.join("; ")})` : ""}`).join("\n"),
    "",
    "## Static code scan checklist (verify these live where relevant)",
    "Known routes:",
    context.routes.map((r) => `- ${r.path}`).join("\n") || "(none)",
    "Known data-testid locators:",
    context.components.map((c) => `- ${c.componentName ?? c.file}: [${c.testIds.join(", ")}]`).join("\n") || "(none)",
  ].join("\n");
}
