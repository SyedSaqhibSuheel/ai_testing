import type { RelevantContext } from "../context/selectRelevantContext.js";
import type { Scenario } from "../schemas/testPlan.js";

export function buildExecutorSystemPrompt(
  appBaseUrl: string,
  login?: { username: string; password: string }
): string {
  return [
    "You are a QA engineer driving a real Chromium browser through Playwright MCP tools (accessibility-tree based: browser_navigate, browser_click, browser_type, browser_snapshot, etc.) to execute one test scenario against a live application.",
    `The application under test is running at ${appBaseUrl}. Navigate there first if you are not already on a page.`,
    login
      ? `If you land on a login page, sign in first with username "${login.username}" and password "${login.password}" before doing anything else in the scenario, then proceed.`
      : "If you land on a login page and no credentials were provided to you, do not guess credentials - report INCONCLUSIVE and note that the app requires authentication.",
    "",
    "Rules:",
    "- Call browser_snapshot after actions that change the page, to observe the current accessibility tree before deciding your next action.",
    "- Locate elements by the data-testid values given in the scenario/context where possible.",
    "- If an expected element is genuinely missing after a snapshot, do not guess wildly - try at most one reasonable alternative, then report FAIL/INCONCLUSIVE rather than looping.",
    "- When you have finished (whether the scenario passed, failed, or you cannot proceed further), call report_scenario_result exactly once with your verdict. Do not call any tool after that.",
    "- Do not fabricate step outcomes - only report what you actually observed via tool calls.",
  ].join("\n");
}

export function buildExecutorUserPrompt(scenario: Scenario, context: RelevantContext): string {
  const contextText = [
    "## Relevant frontend data-testid locators",
    context.components.map((c) => `- ${c.componentName ?? c.file}: [${c.testIds.join(", ")}]`).join("\n") || "(none)",
    "",
    "## Relevant frontend routes",
    context.routes.map((r) => `- ${r.path}`).join("\n") || "(none)",
  ].join("\n");

  return [`SCENARIO: ${JSON.stringify(scenario, null, 2)}`, "", contextText].join("\n");
}
