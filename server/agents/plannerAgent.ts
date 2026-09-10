import { and, desc, eq } from "drizzle-orm";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, scenarios, explorationRuns, type DiscoveredTestId } from "../db/schema.js";
import { buildContext } from "../../src/context/buildContext.js";
import { selectRelevantContext } from "../../src/context/selectRelevantContext.js";
import { getProvider } from "../../src/llm/index.js";
import { startPlaywrightMcp } from "../../src/mcp/playwrightClient.js";
import { exploreApp } from "./exploreApp.js";
import { GroundedPlansSchema } from "../schemas/groundedPlan.js";
import { buildGroundSystemPrompt, buildGroundUserPrompt } from "./groundPrompts.js";
import { startAgentRun, updateAgentRunTask, completeAgentRun, failAgentRun } from "./agentRunTracking.js";
import { getPlatformSettings } from "../settings/settingsService.js";
import { shouldAutoApprove } from "../approval/gate.js";
import { approveScenario } from "../scenarios/scenarioTransitions.js";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return JSON.parse(fenced ? fenced[1] : text);
}

function mergeTestIdSources(
  liveTestIds: Array<{ testId: string; component?: string }>,
  staticTestIds: Set<string>
): DiscoveredTestId[] {
  const liveSet = new Set(liveTestIds.map((t) => t.testId));
  const merged: DiscoveredTestId[] = liveTestIds.map((t) => ({
    testId: t.testId,
    component: t.component,
    source: staticTestIds.has(t.testId) ? "both" : "live",
  }));
  for (const testId of staticTestIds) {
    if (!liveSet.has(testId)) merged.push({ testId, source: "static" });
  }
  return merged;
}

/**
 * Runs the Playwright Planner end to end for a requirement: explores the
 * live app (server/agents/exploreApp.ts), then grounds every approved
 * scenario into a concrete plan (real testids/routes/backend calls) for
 * human review. Never asserts pass/fail - that's a future phase.
 */
export async function runPlannerAgent(db: Db, config: Config, requirementId: string): Promise<void> {
  const requirement = db.select().from(requirements).where(eq(requirements.id, requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${requirementId} not found`);

  const approvedScenarios = db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.status, "approved")))
    .all();
  if (approvedScenarios.length === 0) {
    throw new Error("No approved scenarios to plan for - approve at least one scenario first.");
  }

  const runId = startAgentRun(db, { agentType: "planner", requirementId, input: { scenarioIds: approvedScenarios.map((s) => s.id) } });
  db.update(requirements).set({ status: "planning", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();
  for (const s of approvedScenarios) {
    db.update(scenarios).set({ status: "grounding_in_progress", updatedAt: new Date() }).where(eq(scenarios.id, s.id)).run();
  }

  const context = buildContext(config.backendSrcDir, config.frontendSrcDir, config.frontendServerSrcDir, config.cacheDir);
  const relevant = selectRelevantContext(requirement.rawText, context);
  const provider = getProvider(config);

  let explorationId: string | undefined;
  const mcpSession = await startPlaywrightMcp(config.rootDir, config.mcpHeadless);

  try {
    updateAgentRunTask(db, runId, "Exploring application");
    const explored = await exploreApp(
      provider,
      mcpSession,
      requirement.rawText,
      approvedScenarios.map((s) => ({ title: s.title, preconditions: s.preconditions as string[] })),
      relevant,
      config.appBaseUrl
    );

    const screenshotDir = path.join(config.rootDir, "data", "explorations", runId);
    mkdirSync(screenshotDir, { recursive: true });
    const screenshotPaths = explored.images.map((img, i) => {
      const file = path.join(screenshotDir, `${String(i).padStart(2, "0")}-${img.toolName}.png`);
      writeFileSync(file, Buffer.from(img.base64, "base64"));
      return file;
    });

    const staticTestIds = new Set(context.frontend.components.flatMap((c) => c.testIds));
    const explorationRow = db
      .insert(explorationRuns)
      .values({
        requirementId,
        agentRunId: runId,
        discoveredRoutes: explored.findings.discoveredRoutes,
        discoveredTestIds: mergeTestIdSources(explored.findings.discoveredTestIds, staticTestIds),
        discoveredFlows: explored.findings.discoveredFlows,
        crossReferenceNotes: explored.findings.crossReferenceNotes,
        screenshotPaths,
        rawTranscript: explored.transcript,
        status: explored.status === "timeout" ? "timeout" : "completed",
        finishedAt: new Date(),
      })
      .returning({ id: explorationRuns.id })
      .get();
    explorationId = explorationRow.id;

    updateAgentRunTask(db, runId, "Building test plan");
    const groundSystem = buildGroundSystemPrompt();
    const groundUser = buildGroundUserPrompt(
      requirement.rawText,
      approvedScenarios.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        preconditions: s.preconditions as string[],
        draftSteps: s.draftSteps as string[],
        expectedResult: s.expectedResult,
      })),
      explored.findings,
      relevant
    );

    const chatResult = await provider.chat([{ role: "system", text: groundSystem }, { role: "user", text: groundUser }], []);
    const parsed = GroundedPlansSchema.safeParse(extractJson(chatResult.text ?? ""));
    if (!parsed.success) {
      throw new Error(`Grounding output failed schema validation: ${JSON.stringify(parsed.error.issues)}`);
    }

    const { approvalMode } = getPlatformSettings(db, config);
    const autoApproveG2 = shouldAutoApprove(approvalMode, "G2_grounded_plan", true);

    const plansById = new Map(parsed.data.plans.map((p) => [p.id, p]));
    for (const s of approvedScenarios) {
      const plan = plansById.get(s.id);
      db.update(scenarios)
        .set({ groundedPlan: plan ?? null, status: "grounded_pending_review", updatedAt: new Date() })
        .where(eq(scenarios.id, s.id))
        .run();
      if (autoApproveG2) approveScenario(db, s.id, "system", "system_auto");
    }

    db.update(requirements).set({ status: "awaiting_plan_approval", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();
    completeAgentRun(db, runId, { explorationRunId: explorationId, groundedCount: plansById.size });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    failAgentRun(db, runId, message);
    db.update(requirements).set({ status: "failed", updatedAt: new Date() }).where(eq(requirements.id, requirementId)).run();
    for (const s of approvedScenarios) {
      db.update(scenarios).set({ status: "approved", updatedAt: new Date() }).where(eq(scenarios.id, s.id)).run();
    }
    throw err;
  } finally {
    await mcpSession.close();
  }
}

export function getLatestExplorationRun(db: Db, requirementId: string) {
  return db
    .select()
    .from(explorationRuns)
    .where(eq(explorationRuns.requirementId, requirementId))
    .orderBy(desc(explorationRuns.startedAt))
    .get();
}
