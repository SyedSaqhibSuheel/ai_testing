import type { LlmProvider } from "../llm/types.js";
import type { RelevantContext } from "../context/selectRelevantContext.js";
import type { Scenario } from "../schemas/testPlan.js";
import type { ScenarioResult, TranscriptTurn } from "../schemas/scenarioResult.js";
import { ClassificationResultSchema, type ClassificationResult } from "../schemas/classification.js";
import { buildClassifierSystemPrompt, buildClassifierUserPrompt } from "./prompts.js";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

/**
 * Models routinely return confidence as a 0-100 percentage despite being
 * told to use 0-1 - normalize rather than let a strict schema throw away an
 * otherwise-valid classification over a units mismatch.
 */
function normalizeConfidence(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || !("confidence" in raw)) return raw;
  const obj = raw as { confidence: unknown };
  if (typeof obj.confidence === "number" && obj.confidence > 1 && obj.confidence <= 100) {
    return { ...raw, confidence: obj.confidence / 100 };
  }
  return raw;
}

export async function classifyFailure(
  provider: LlmProvider,
  requirement: string,
  scenario: Scenario,
  result: ScenarioResult,
  transcript: TranscriptTurn[],
  context: RelevantContext
): Promise<ClassificationResult> {
  const system = buildClassifierSystemPrompt();
  const user = buildClassifierUserPrompt(requirement, scenario, result, transcript, context);

  const chatResult = await provider.chat(
    [
      { role: "system", text: system },
      { role: "user", text: user },
    ],
    []
  );

  const parsed = ClassificationResultSchema.safeParse(normalizeConfidence(extractJson(chatResult.text ?? "")));
  if (parsed.success) return parsed.data;

  return {
    scenarioId: scenario.id,
    classification: "INCONCLUSIVE",
    confidence: 0,
    evidenceKind: "NARRATIVE_INFERENCE",
    evidence: [`Classifier output failed schema validation: ${JSON.stringify(parsed.error.issues)}`],
    reasoning: "The classifier's response could not be parsed as valid JSON matching the expected schema.",
  };
}

/** Pre-execution classification for a scenario flagged by validatePlan - no LLM call needed. */
export function testScriptErrorClassification(scenarioId: string, issues: string[]): ClassificationResult {
  return {
    scenarioId,
    classification: "TEST_SCRIPT_ERROR",
    confidence: 1,
    evidenceKind: "STATIC_PLAN_VS_SCAN",
    evidence: issues,
    reasoning: "This scenario referenced a route, data-testid, or backend endpoint that does not exist in the current codebase scan, caught before any browser/LLM budget was spent.",
  };
}
