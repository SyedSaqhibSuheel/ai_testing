import type { RelevantContext } from "../../src/context/selectRelevantContext.js";
import type { FrontendModule } from "./codeAnalysisAgent.js";

const MAX_SOURCE_CHARS = 12000;

export function buildCodeAnalysisSystemPrompt(): string {
  return [
    "MOCK_TASK: intelligence",
    "You are a senior QA analyst for the CallCenterUI application - the actual call center agent helpdesk product (React frontend). You are NOT given a human-written requirement. Instead you are given the real source code of ONE screen or component from this app, plus (for reference only) any backend API endpoints it appears to call. Read the code like a QA engineer seeing it for the first time and reverse-engineer what it does, then propose tests for it.",
    "",
    "From the code alone, infer:",
    "- functionalRequirements: the discrete functional behaviors this screen/component implements - what a call center agent can see and do here.",
    "- userRoles: which actor(s) use this screen (e.g. Call Center Agent, Administrator) - infer from the code, props, and any role checks.",
    "- validationRules: validation/business rules implied by the code (required fields, disabled states, conditional rendering, error states, confirmation steps before a destructive action).",
    "- riskAreas: parts of this screen most likely to hide bugs, with why (e.g. an irreversible Approve/Deny action, async state that can race, a search/filter that can return zero results).",
    "- suggestedCoverage: short list of testing angles worth covering.",
    "- scenarios: a draft list of concrete test scenarios covering positive, negative, and edge cases. Cover EVERY interactive element you find (every button, input, toggle) at least once, including what happens when an action succeeds and when it fails/is cancelled. Reference the actual data-testid values from the code where relevant so a later grounding step can find them, but keep draftSteps in plain English (no Playwright syntax yet).",
    "",
    "Output ONLY a single JSON object matching this shape (no markdown fences, no commentary):",
    JSON.stringify(
      {
        functionalRequirements: [{ description: "string" }],
        userRoles: ["string"],
        validationRules: ["string"],
        riskAreas: [{ area: "string", reason: "string" }],
        suggestedCoverage: ["string"],
        scenarios: [
          {
            title: "string",
            description: "string",
            scenarioType: "positive | negative | edge_case",
            priority: "low | medium | high | critical",
            riskLevel: "low | medium | high",
            preconditions: ["string"],
            draftSteps: ["string - plain English, no UI locators yet"],
            expectedResult: "string",
            aiConfidence: 0.0,
          },
        ],
      },
      null,
      2
    ),
  ].join("\n");
}

/**
 * Auto-generated stand-in for the "human-written requirement" text the
 * Intelligence Agent normally gets - used both as the requirement row's
 * rawText and (as a `REQUIREMENT:` line below) so the mock LLM provider's
 * MOCK_TASK: intelligence handler still extracts something sensible.
 */
export function buildAutoRequirementText(module: FrontendModule): string {
  const actions = module.testIds.filter((t) => /^button|^tab/i.test(t.replace(/^`|`$/g, "")));
  const actionsNote = actions.length ? ` Known interactive elements: ${actions.join(", ")}.` : "";
  return `Auto-generated from source code analysis of the CallCenterUI screen/component "${module.componentName}" (${module.relativePath}).${actionsNote}`;
}

export function buildCodeAnalysisUserPrompt(module: FrontendModule, source: string, backendContext: RelevantContext): string {
  const truncated = source.length > MAX_SOURCE_CHARS;
  const sourceExcerpt = truncated ? `${source.slice(0, MAX_SOURCE_CHARS)}\n\n... (truncated, ${source.length - MAX_SOURCE_CHARS} more characters)` : source;

  const backendEndpoints =
    backendContext.controllers.flatMap((c) => c.endpoints.map((e) => `- ${e.httpMethod} ${e.path}${e.summary ? ` - ${e.summary}` : ""} (from ${c.className})`)).join("\n") ||
    "(no obviously related backend endpoint found by static scan - infer from fetch/API calls in the code itself if present)";

  return [
    `REQUIREMENT: ${buildAutoRequirementText(module)}`,
    "",
    `SCREEN/COMPONENT: ${module.componentName} (${module.relativePath})`,
    module.testIds.length ? `Known data-testid values found in this file: ${module.testIds.join(", ")}` : "No data-testid attributes found in this file.",
    "",
    "## Source code",
    "```tsx",
    sourceExcerpt,
    "```",
    "",
    "## Backend API endpoints that may back this screen (reference only, from a static scan - may be incomplete or wrong)",
    backendEndpoints,
  ].join("\n");
}
