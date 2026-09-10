import type { RelevantContext } from "../../src/context/selectRelevantContext.js";

export function buildIntelligenceSystemPrompt(): string {
  return [
    "MOCK_TASK: intelligence",
    "You are a senior QA analyst for a banking helpdesk web application (React frontend + Spring Boot API). A human submitted a plain-English test requirement. Analyze it thoroughly.",
    "",
    "Identify:",
    "- functionalRequirements: the discrete functional behaviors implied by the requirement.",
    "- userRoles: every user role/actor mentioned or implied (e.g. Administrator, Normal user).",
    "- validationRules: explicit or implied validation/business rules (e.g. 'email is mandatory', 'duplicate emails must be rejected').",
    "- riskAreas: parts of this requirement most likely to hide bugs, with why.",
    "- suggestedCoverage: short list of testing angles worth covering.",
    "- scenarios: a draft list of concrete test scenarios covering positive, negative, and edge cases. Every validation rule and every role mentioned MUST be covered by at least one scenario. Do not generate execution steps tied to specific UI elements yet (no data-testid/route references) - these are DRAFT/intent-level steps only, in plain English; a later stage grounds them against the real app.",
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

export function buildIntelligenceUserPrompt(requirementText: string, context: RelevantContext): string {
  const appSummary = [
    "## Known application areas (for grounding your understanding only - do not reference specific testids/routes yet)",
    context.routes.map((r) => `- ${r.path}`).join("\n") || "(none)",
    context.components.map((c) => `- ${c.componentName ?? c.file}`).join("\n") || "(none)",
  ].join("\n");

  return [`REQUIREMENT: ${requirementText}`, "", appSummary].join("\n");
}

/**
 * Reuses the exact same "scenarios" array shape as the main analysis, but
 * asks for exactly one replacement scenario - keeps the mock provider and
 * schema validation identical for both paths.
 */
export function buildRegenerateUserPrompt(requirementText: string, existing: { title: string; description: string }, feedback?: string): string {
  return [
    `REQUIREMENT: ${requirementText}`,
    "",
    "Produce exactly ONE replacement scenario in the scenarios array (the other fields - functionalRequirements/userRoles/etc - can be minimal/empty, they are ignored for this call).",
    `The scenario being replaced was: "${existing.title}" - ${existing.description}`,
    feedback ? `Human feedback on why it needs to change: ${feedback}` : "Improve it: sharpen the scenario's focus, make it more specific and testable than the original.",
  ].join("\n");
}
