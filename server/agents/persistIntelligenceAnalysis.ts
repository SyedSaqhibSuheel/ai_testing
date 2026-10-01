import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, requirementAnalyses, scenarios } from "../db/schema.js";
import type { IntelligenceAnalysis, DraftScenario } from "../schemas/analysis.js";
import { getPlatformSettings } from "../settings/settingsService.js";
import { shouldAutoApprove } from "../approval/gate.js";
import { approveScenario } from "../scenarios/scenarioTransitions.js";

export async function insertScenarioFromDraft(
  db: Db,
  draft: DraftScenario,
  requirementId: string,
  analysisId: string | null
): Promise<string> {
  const [row] = await db
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
    .returning({ id: scenarios.id });
  return row.id;
}

/**
 * Shared by the Intelligence Agent (human-written requirement) and the Code
 * Analysis Agent (requirement auto-derived from source code): both produce
 * the same IntelligenceAnalysis shape, so both store it, insert its draft
 * scenarios, apply the same auto-approval gate, and advance the requirement
 * to `awaiting_scenario_approval` identically.
 */
export async function persistIntelligenceAnalysis(
  db: Db,
  config: Config,
  requirementId: string,
  agentRunId: string,
  analysis: IntelligenceAnalysis
): Promise<{ analysisId: string; scenarioCount: number }> {
  const [analysisRow] = await db
    .insert(requirementAnalyses)
    .values({
      requirementId,
      agentRunId,
      functionalRequirements: analysis.functionalRequirements,
      userRoles: analysis.userRoles,
      validationRules: analysis.validationRules,
      riskAreas: analysis.riskAreas,
      suggestedCoverage: analysis.suggestedCoverage,
      rawModelOutput: analysis,
      status: "completed",
    })
    .returning({ id: requirementAnalyses.id });

  const { approvalMode } = await getPlatformSettings(db, config);
  const autoApproveG1 = shouldAutoApprove(approvalMode, "G1_scenario_intent", true);
  for (const draft of analysis.scenarios) {
    const newId = await insertScenarioFromDraft(db, draft, requirementId, analysisRow.id);
    if (autoApproveG1) await approveScenario(db, newId, "system", "system_auto");
  }

  await db
    .update(requirements)
    .set({ status: "awaiting_scenario_approval", currentAnalysisId: analysisRow.id, updatedAt: new Date() })
    .where(eq(requirements.id, requirementId));

  return { analysisId: analysisRow.id, scenarioCount: analysis.scenarios.length };
}
