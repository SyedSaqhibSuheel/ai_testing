import type { RelevantContext } from "../../src/context/selectRelevantContext.js";
import type { ExplorationFindings } from "../schemas/exploration.js";

export function buildGroundSystemPrompt(): string {
  return [
    "MOCK_TASK: ground",
    "You are a QA engineer turning approved draft test scenarios into a concrete, grounded Playwright test plan for a banking helpdesk web app.",
    "You are given: the original requirement, each approved scenario's draft intent, real live-exploration findings (routes/testids/flows actually observed in the running app), and a static code scan.",
    "",
    "For EACH scenario given, produce ONE grounded plan with the SAME id as the input scenario. Rules:",
    "- Every step that targets a UI element MUST use an EXACT data-testid from the exploration findings or static scan - prefer testids that appear in BOTH (highest confidence). Never invent one.",
    "- Every step that targets a route MUST use an exact route from the findings/scan.",
    "- expectedBackendCalls must use exact method+path pairs from the static scan.",
    "- passCriteria must be concrete and checkable, traceable back to the scenario's own expectedResult - do not invent business rules.",
    "- Login steps: NEVER make up credentials (no 'testagent', 'password123', 'admin', etc.). If a LOGIN section is given below, use its exact username/password as the inputValue of the username/password steps. If LOGIN LOCATORS are given, the login form has no data-testids - leave targetTestId empty on those steps and put the exact locator expression in `notes`. If no login is configured, leave inputValue empty and note 'login credentials not configured'.",
    "- You are given `scenarioPaths` below: live-verified, per-scenario reachability findings from an agent that actually clicked through the real running app (not just read the code). Match each plan to its scenarioPaths entry by exact title.",
    "- If that entry has reachable:true, your `steps` array MUST begin with its exact `steps` sequence (same actions/testids/routes, in the same order) BEFORE any assertion step - do not shortcut straight to the assertion and assume the precondition already holds (it usually doesn't; the scenario's own precondition text often describes a prop/state the component's author could set directly in a unit test, not something visible by default in a real browser).",
    "- If that entry has reachable:false, set this plan's `groundable` to false and `ungroundableReason` to its exact `unreachableReason` - do NOT invent a fake path to make it look testable. Still produce minimal `steps`/`passCriteria` describing the gap (they won't be executed).",
    "- If a scenario has no matching scenarioPaths entry at all (exploration skipped it), treat it the same as reachable:false with ungroundableReason explaining exploration didn't cover it.",
    "",
    "Output ONLY a single JSON object: { \"plans\": [ <one grounded plan per input scenario, same shape as below> ] } - no markdown fences, no commentary.",
    JSON.stringify(
      {
        plans: [
          {
            id: "the input scenario's exact id",
            title: "string",
            requirementRef: "string",
            preconditions: ["string"],
            steps: [
              { index: 0, action: "string", targetTestId: "string (optional)", targetRoute: "string (optional)", inputValue: "string (optional)", notes: "string (optional)" },
            ],
            expectedBackendCalls: [{ method: "GET|POST|PUT|DELETE|PATCH", path: "string", expectedStatus: 200 }],
            expectedUiOutcomes: ["string"],
            passCriteria: ["string"],
            groundable: "boolean - false only if the matching scenarioPaths entry was reachable:false",
            ungroundableReason: "string (optional) - copy verbatim from scenarioPaths.unreachableReason when groundable is false",
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");
}

export function buildGroundUserPrompt(
  requirementText: string,
  scenarios: Array<{ id: string; title: string; description: string; preconditions: string[]; draftSteps: string[]; expectedResult: string }>,
  findings: ExplorationFindings,
  context: RelevantContext,
  login?: { username: string; password: string; usernameLocator?: string; passwordLocator?: string; submitLocator?: string }
): string {
  const loginSection = !login
    ? "## Login\nNo login credentials configured."
    : [
        "## Login",
        `Username: "${login.username}"`,
        `Password: "${login.password}"`,
        login.usernameLocator && login.passwordLocator && login.submitLocator
          ? `## LOGIN LOCATORS (login form has no data-testids)\nUsername field: ${login.usernameLocator}\nPassword field: ${login.passwordLocator}\nSubmit action: ${login.submitLocator}`
          : null,
      ]
        .filter(Boolean)
        .join("\n");

  return [
    `REQUIREMENT: ${requirementText}`,
    "",
    "## Approved scenarios to ground",
    JSON.stringify(scenarios, null, 2),
    "",
    "## Live exploration findings",
    `Routes: ${findings.discoveredRoutes.join(", ") || "(none)"}`,
    `Testids: ${findings.discoveredTestIds.map((t) => t.testId).join(", ") || "(none)"}`,
    `Flows: ${findings.discoveredFlows.join(" | ") || "(none)"}`,
    `Cross-reference notes: ${findings.crossReferenceNotes.join(" | ") || "(none)"}`,
    "",
    "## Per-scenario reachability (scenarioPaths - match by exact title, see rules above)",
    JSON.stringify(findings.scenarioPaths, null, 2),
    "",
    "## Static code scan",
    "Routes:",
    context.routes.map((r) => `- ${r.path}`).join("\n") || "(none)",
    "Testids:",
    context.components.map((c) => `- ${c.componentName ?? c.file}: [${c.testIds.join(", ")}]`).join("\n") || "(none)",
    "Backend endpoints:",
    context.controllers.flatMap((c) => c.endpoints.map((e) => `- ${e.httpMethod} ${e.path}`)).join("\n") || "(none)",
    "",
    loginSection,
  ].join("\n");
}
