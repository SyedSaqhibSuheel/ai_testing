import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, requirementAnalyses, scenarios, approvalAuditLog } from "../db/schema.js";
import { buildContext } from "../../src/context/buildContext.js";
import { selectRelevantContext } from "../../src/context/selectRelevantContext.js";
import { getProvider } from "../../src/llm/index.js";
import { IntelligenceAnalysisSchema, type IntelligenceAnalysis, type DraftScenario } from "../schemas/analysis.js";
import { buildIntelligenceSystemPrompt, buildIntelligenceUserPrompt, buildRegenerateUserPrompt } from "./intelligencePrompts.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { getPlatformSettings } from "../settings/settingsService.js";
import { shouldAutoApprove } from "../approval/gate.js";
import { approveScenario } from "../scenarios/scenarioTransitions.js";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

async function callIntelligenceLlm(config: Config, requirementText: string): Promise<IntelligenceAnalysis> {
  const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
  const relevant = selectRelevantContext(requirementText, context);
  const provider = getProvider(config);

  const system = buildIntelligenceSystemPrompt();
  const user = buildIntelligenceUserPrompt(requirementText, relevant);

  const attempt = async (extra?: string) => {
    const result = await provider.chat(
      [
        { role: "system", text: system },
        { role: "user", text: extra ? `${user}\n\n${extra}` : user },
      ],
      []
    );
    const parsed = IntelligenceAnalysisSchema.safeParse(extractJson(result.text ?? ""));
    if (!parsed.success) {
      throw new Error(`Intelligence agent output failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    }
    return parsed.data;
  };

  try {
    return await attempt();
  } catch (firstError) {
    return await attempt(
      `Your previous response was invalid: ${(firstError as Error).message}. Return ONLY the corrected JSON object.`
    );
  }
}

function insertScenarioFromDraft(
  db: Db,
  draft: DraftScenario,
  requirementId: string,
  analysisId: string | null
): string {
  const row = db
    .insert(scenarios)
    .values({
      requirementId,
      analysisId: analysisId ?? undefined,
      sourceType: "ai_generated",
      title: draft.title,
      description: draft.description,
      priority: draft.priority,
      riskLevel: draft.riskLevel,
      preconditions: draft.preconditions,
      draftSteps: draft.draftSteps,
      expectedResult: draft.expectedResult,
      aiConfidence: draft.aiConfidence,
      status: "ai_proposed",
    })
    .returning({ id: scenarios.id })
    .get();
  return row.id;
}

/**
 * Runs the AI Testing Intelligence Layer for a requirement: analyzes it into
 * functional requirements/roles/validation rules/risk areas, and proposes a
 * draft scenario list (status `ai_proposed`) for human review. Does not
 * ground scenarios against the live app - that's the Planner's job.
 */
export async function runIntelligenceAgent(db: Db, config: Config, requirementId: string): Promise<void> {
  const requirement = db.select().from(requirements).where(eq(requirements.id, requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${requirementId} not found`);

  const runId = startAgentRun(db, { agentType: "intelligence", requirementId, input: { requirementText: requirement.rawText } });
  db.update(requirements).set({ status: "analyzing", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();

  try {
    updateAgentRunTask(db, runId, "Analyzing");
    const analysis = await callIntelligenceLlm(config, requirement.rawText);

    const analysisRow = db
      .insert(requirementAnalyses)
      .values({
        requirementId,
        agentRunId: runId,
        functionalRequirements: analysis.functionalRequirements,
        userRoles: analysis.userRoles,
        validationRules: analysis.validationRules,
        riskAreas: analysis.riskAreas,
        suggestedCoverage: analysis.suggestedCoverage,
        rawModelOutput: analysis,
        status: "completed",
      })
      .returning({ id: requirementAnalyses.id })
      .get();

    const { approvalMode } = getPlatformSettings(db, config);
    const autoApproveG1 = shouldAutoApprove(approvalMode, "G1_scenario_intent", true);
    for (const draft of analysis.scenarios) {
      const newId = insertScenarioFromDraft(db, draft, requirementId, analysisRow.id);
      if (autoApproveG1) approveScenario(db, newId, "system", "system_auto");
    }

    db.update(requirements)
      .set({ status: "awaiting_scenario_approval", currentAnalysisId: analysisRow.id, updatedAt: new Date() })
      .where(eq(requirements.id, requirementId))
      .run();

    completeAgentRun(db, runId, { analysisId: analysisRow.id, scenarioCount: analysis.scenarios.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failAgentRun(db, runId, message);
    db.update(requirements).set({ status: "failed", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();
    throw err;
  }
}

/**
 * Replaces one scenario with a fresh AI-generated alternative: soft-deletes
 * the old row (kept for audit history, never hard-deleted) and inserts a new
 * `ai_proposed` scenario in its place, on the same requirement/analysis.
 */
export async function regenerateScenario(db: Db, config: Config, scenarioId: string, actor: string, feedback?: string): Promise<string> {
  const scenario = db.select().from(scenarios).where(eq(scenarios.id, scenarioId)).get();
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found`);
  const requirement = db.select().from(requirements).where(eq(requirements.id, scenario.requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${scenario.requirementId} not found`);

  const runId = startAgentRun(db, {
    agentType: "intelligence",
    requirementId: scenario.requirementId,
    scenarioId,
    input: { regenerating: scenarioId, feedback },
  });
  updateAgentRunTask(db, runId, "Analyzing");

  try {
    const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
    const relevant = selectRelevantContext(requirement.rawText, context);
    const provider = getProvider(config);

    const result = await provider.chat(
      [
        { role: "system", text: buildIntelligenceSystemPrompt() },
        {
          role: "user",
          text: `${buildRegenerateUserPrompt(requirement.rawText, scenario, feedback)}\n\n${buildIntelligenceUserPrompt(requirement.rawText, relevant)}`,
        },
      ],
      []
    );
    const parsed = IntelligenceAnalysisSchema.safeParse(extractJson(result.text ?? ""));
    if (!parsed.success || parsed.data.scenarios.length === 0) {
      throw new Error(`Regenerate output failed schema validation: ${parsed.success ? "no scenarios returned" : JSON.stringify(parsed.error.issues)}`);
    }

    db.update(scenarios).set({ isDeleted: true, updatedAt: new Date() }).where(eq(scenarios.id, scenarioId)).run();
    db.insert(approvalAuditLog)
      .values({
        entityType: "scenario",
        entityId: scenarioId,
        action: "regenerate_requested",
        actorType: "human",
        actor,
        reason: feedback,
        previousStatus: scenario.status,
        newStatus: "rejected",
      })
      .run();

    const newId = insertScenarioFromDraft(db, parsed.data.scenarios[0], scenario.requirementId, scenario.analysisId);
    completeAgentRun(db, runId, { replacedScenarioId: scenarioId, newScenarioId: newId });
    return newId;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failAgentRun(db, runId, message);
    throw err;
  }
}
