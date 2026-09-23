import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, scenarios, approvalAuditLog } from "../db/schema.js";
import { buildContext } from "../../src/context/buildContext.js";
import { selectRelevantContext, type RelevantContext } from "../../src/context/selectRelevantContext.js";
import { isKnownAppUrl } from "../config/appProfile.js";
import { getProvider } from "../../src/llm/index.js";
import { IntelligenceAnalysisSchema, type IntelligenceAnalysis } from "../schemas/analysis.js";
import { buildIntelligenceSystemPrompt, buildIntelligenceUserPrompt, buildRegenerateUserPrompt } from "./intelligencePrompts.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { persistIntelligenceAnalysis, insertScenarioFromDraft } from "./persistIntelligenceAnalysis.js";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

const EMPTY_CONTEXT: RelevantContext = { controllers: [], dtos: [], components: [], routes: [] };

async function callIntelligenceLlm(config: Config, requirementText: string, isKnownApp: boolean): Promise<IntelligenceAnalysis> {
  const relevant = isKnownApp
    ? selectRelevantContext(requirementText, buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir))
    : EMPTY_CONTEXT;
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

/**
 * Runs the AI Testing Intelligence Layer for a requirement: analyzes it into
 * functional requirements/roles/validation rules/risk areas, and proposes a
 * draft scenario list (status `ai_proposed`) for human review. Does not
 * ground scenarios against the live app - that's the Planner's job.
 */
export async function runIntelligenceAgent(db: Db, config: Config, requirementId: string, activeAppBaseUrl?: string): Promise<void> {
  const requirement = db.select().from(requirements).where(eq(requirements.id, requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${requirementId} not found`);

  const runId = startAgentRun(db, { agentType: "intelligence", requirementId, input: { requirementText: requirement.rawText } });
  db.update(requirements).set({ status: "analyzing", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();

  try {
    updateAgentRunTask(db, runId, "Analyzing");
    const isKnownApp = isKnownAppUrl(activeAppBaseUrl ?? config.appBaseUrl, config);
    const analysis = await callIntelligenceLlm(config, requirement.rawText, isKnownApp);

    const { analysisId, scenarioCount } = persistIntelligenceAnalysis(db, config, requirementId, runId, analysis);

    completeAgentRun(db, runId, { analysisId, scenarioCount });
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
export async function regenerateScenario(
  db: Db,
  config: Config,
  scenarioId: string,
  actor: string,
  feedback?: string,
  activeAppBaseUrl?: string
): Promise<string> {
  const scenario = db.select().from(scenarios).where(eq(scenarios.id, scenarioId)).get();
  if (!scenario) throw new Error(`Scenario ${scenarioId} not found`);
  const requirement = db.select().from(requirements).where(eq(requirements.id, scenario.requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${scenario.requirementId} not found`);
  const isKnownApp = isKnownAppUrl(activeAppBaseUrl ?? config.appBaseUrl, config);

  const runId = startAgentRun(db, {
    agentType: "intelligence",
    requirementId: scenario.requirementId,
    scenarioId,
    input: { regenerating: scenarioId, feedback },
  });
  updateAgentRunTask(db, runId, "Analyzing");

  try {
    const relevant = isKnownApp
      ? selectRelevantContext(requirement.rawText, buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir))
      : EMPTY_CONTEXT;
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
