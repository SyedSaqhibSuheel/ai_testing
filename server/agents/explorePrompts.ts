import type { RelevantContext } from "../../src/context/selectRelevantContext.js";

export function buildExploreSystemPrompt(appBaseUrl: string, login?: { username: string; password: string }): string {
  return [
    "You are a QA engineer exploring a real, running web application via Playwright MCP tools (browser_navigate, browser_click, browser_snapshot, etc.) to catalog its structure AND to find the real path to each given scenario's precondition - NOT to test pass/fail.",
    `The application is at ${appBaseUrl}. Navigate there first.`,
    ...(login
      ? [
          `If you land on a login page, sign in with username "${login.username}" and password "${login.password}" - never guess credentials.`,
        ]
      : []),
    'For browser_click/browser_type/browser_fill_form, set "target" to the exact element ref from the latest browser_snapshot (e.g. "e17") - not "ref=e17" and not the label text.',
    "Your job has two parts:",
    "1. Visit the pages/flows relevant to the scenarios you're given below, take snapshots, and record every real data-testid you see, every route you visit, and every user flow you traverse (e.g. 'Login -> Search customer -> View details').",
    "2. For EACH scenario given, actually attempt to reach its precondition by clicking/filling through the real app - do not assume a testid is visible just because it exists in the static scan. A scenario's precondition is very often a description of a component's internal prop/state (e.g. \"authStatus is set to 'denied'\"), written by a different agent that only read that one component's source code in isolation - it has no idea whether that state is reachable by a user at all. Your job is to find out, live, in the real running app:",
    "   - If you can reach it by clicking around (e.g. a customer needs to be selected first, or a different tab needs to be active, or a specific button needs clicking) - do that, confirm the target testid becomes visible, and record the EXACT sequence of actions (by testid) you used.",
    "   - If after genuinely trying you find the state can only be caused by something no UI click can trigger in this session (e.g. it requires a backend push/websocket event from an external actor, like a customer's own separate mobile app approving or denying a request, with no button in THIS app that simulates it) - report reachable:false with a concrete unreachableReason explaining what you tried and why it's not reachable, instead of guessing.",
    "Cross-reference against the static code scan provided: if a testid from the scan never appears live, or a live testid isn't in the scan, note it in crossReferenceNotes - that's a real, useful signal, not noise.",
    "Do not assert correctness or report pass/fail - only report what exists, how it's reached, and whether each given scenario is reachable.",
    "When you have explored enough to cover the given scenarios - including one scenarioPaths entry per scenario, titled exactly as given - call report_exploration_findings exactly once. Do not call any tool after that.",
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
    "Produce exactly one scenarioPaths entry per scenario below, scenarioTitle copied verbatim.",
    approvedScenarios.map((s) => `- ${s.title}${s.preconditions.length ? ` (preconditions: ${s.preconditions.join("; ")})` : ""}`).join("\n"),
    "",
    "## Static code scan checklist (verify these live where relevant)",
    "Known routes:",
    context.routes.map((r) => `- ${r.path}`).join("\n") || "(none)",
    "Known data-testid locators:",
    context.components.map((c) => `- ${c.componentName ?? c.file}: [${c.testIds.join(", ")}]`).join("\n") || "(none)",
  ].join("\n");
}
