import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { testRunCases, testRuns, testFiles, testFileScenarios, scenarios, requirements } from "../db/schema.js";
import { buildContext } from "../../src/context/buildContext.js";
import { getProvider } from "../../src/llm/index.js";
import type { Scenario as GroundedPlan } from "../../src/schemas/testPlan.js";
import { TestFailureClassificationSchema, type TestFailureClassification } from "../schemas/testFailureClassification.js";
import { buildTestFailureSystemPrompt, buildTestFailureUserPrompt } from "./testFailurePrompts.js";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

/**
 * Classifies one failed/timedOut test case as REAL_DEFECT, UI_LOCATOR_CHANGE,
 * TEST_SCRIPT_ERROR, ENVIRONMENT_ERROR, or INCONCLUSIVE - only REAL_DEFECT
 * surfaces as a "Bug" in the dashboard (see TestRunCaseRow in the web app).
 * Deliberately conservative: unsure defaults to INCONCLUSIVE, never
 * REAL_DEFECT, per explicit instruction in the system prompt.
 */
export async function classifyTestFailure(db: Db, config: Config, testRunCaseId: string): Promise<void> {
  const testCase = db.select().from(testRunCases).where(eq(testRunCases.id, testRunCaseId)).get();
  if (!testCase || !testCase.errorMessage) return;

  const run = db.select().from(testRuns).where(eq(testRuns.id, testCase.testRunId)).get();
  if (!run) return;
  const file = db.select().from(testFiles).where(eq(testFiles.id, run.testFileId)).get();
  if (!file) return;
  const requirement = db.select().from(requirements).where(eq(requirements.id, file.requirementId)).get();
  if (!requirement) return;

  const mapping = db
    .select()
    .from(testFileScenarios)
    .where(and(eq(testFileScenarios.testFileId, file.id), eq(testFileScenarios.testTitle, testCase.title)))
    .get();
  const scenario = mapping ? db.select().from(scenarios).where(eq(scenarios.id, mapping.scenarioId)).get() : undefined;
  const groundedPlan = scenario?.groundedPlan as GroundedPlan | null | undefined;

  const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
  const knownTestIds = context.frontend.components.flatMap((c) => c.testIds);

  const provider = getProvider(config);
  const system = buildTestFailureSystemPrompt();
  const user = buildTestFailureUserPrompt({
    requirementText: requirement.rawText,
    passCriteria: groundedPlan?.passCriteria ?? [],
    testFileCode: file.code,
    caseTitle: testCase.title,
    errorMessage: testCase.errorMessage,
    errorStack: testCase.errorStack,
    knownTestIds,
  });

  let result: TestFailureClassification;
  try {
    const chatResult = await provider.chat([{ role: "system", text: system }, { role: "user", text: user }], []);
    const parsed = TestFailureClassificationSchema.safeParse(extractJson(chatResult.text ?? ""));
    if (!parsed.success) {
      result = {
        classification: "INCONCLUSIVE",
        confidence: 0,
        evidenceKind: "NARRATIVE_INFERENCE",
        evidence: [`Classifier output failed schema validation: ${JSON.stringify(parsed.error.issues)}`],
        reasoning: "The classifier's response could not be parsed as valid JSON matching the expected schema.",
      };
    } else {
      result = parsed.data;
    }
  } catch (err) {
    result = {
      classification: "INCONCLUSIVE",
      confidence: 0,
      evidenceKind: "NARRATIVE_INFERENCE",
      evidence: [err instanceof Error ? err.message : String(err)],
      reasoning: "Classification failed to run (LLM call error) - defaulting to INCONCLUSIVE rather than guessing.",
    };
  }

  db.update(testRunCases)
    .set({
      classification: result.classification,
      classificationConfidence: result.confidence,
      classificationEvidenceKind: result.evidenceKind,
      classificationEvidence: result.evidence,
      classificationReasoning: result.reasoning,
      suggestedFix: result.suggestedFix,
    })
    .where(eq(testRunCases.id, testRunCaseId))
    .run();
}
