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
    "- If a scenario truly cannot be grounded (no matching page/testids found), still produce a plan but note the gap in a step's `notes` field.",
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
  context: RelevantContext
): string {
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
    "## Static code scan",
    "Routes:",
    context.routes.map((r) => `- ${r.path}`).join("\n") || "(none)",
    "Testids:",
    context.components.map((c) => `- ${c.componentName ?? c.file}: [${c.testIds.join(", ")}]`).join("\n") || "(none)",
    "Backend endpoints:",
    context.controllers.flatMap((c) => c.endpoints.map((e) => `- ${e.httpMethod} ${e.path}`)).join("\n") || "(none)",
  ].join("\n");
}
