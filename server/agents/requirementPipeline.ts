import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, scenarios, testFiles } from "../db/schema.js";
import { approveScenario } from "../scenarios/scenarioTransitions.js";
import { approveTestFile } from "../testFiles/testFileTransitions.js";
import { commitApprovedTestFiles } from "../git/managedRepo.js";
import { runPlaywrightTest } from "../execution/runTests.js";
import { runPlannerAgent } from "./plannerAgent.js";
import { runGeneratorAgent } from "./generatorAgent.js";
import { getPlatformSettings } from "../settings/settingsService.js";

export type PipelineStage = "approving" | "planning" | "generating" | "committing" | "running" | "done" | "failed";

export interface PipelineState {
  requirementId: string;
  stage: PipelineStage;
  message: string;
  error?: string;
  testFileId?: string;
  testRunId?: string;
  startedAt: string;
  finishedAt?: string;
}

// In-memory only, like the Code Analysis batch flag: the durable record of
// what happened is the requirement/scenario/test-file statuses, audit log,
// agent runs and test runs this writes through the existing functions.
const pipelines = new Map<string, PipelineState>();

export function getPipelineState(requirementId: string): PipelineState | null {
  return pipelines.get(requirementId) ?? null;
}

export function isPipelineRunning(requirementId: string): boolean {
  const state = pipelines.get(requirementId);
  return !!state && state.stage !== "done" && state.stage !== "failed";
}

function activeScenarios(db: Db, requirementId: string) {
  return db
    .select()
    .from(scenarios)
    .where(and(eq(scenarios.requirementId, requirementId), eq(scenarios.isDeleted, false)))
    .all();
}

function latestTestFile(db: Db, requirementId: string) {
  return db
    .select()
    .from(testFiles)
    .where(and(eq(testFiles.requirementId, requirementId), eq(testFiles.isLatest, true)))
    .orderBy(desc(testFiles.version))
    .get();
}


/**
 * Who signs off the gates the pipeline passes through.
 * - "human": someone clicked the one-click pipeline for this requirement;
 *   the click is their explicit sign-off for the whole chain, so they're
 *   recorded as the approver - but only the scenarios they ticked are approved.
 * - "auto": Fully Automatic approval mode - every gate is a system
 *   auto-approval (audit log: system_auto), and every AI-proposed scenario
 *   goes through. Never used in Manual/Semi-Automatic mode.
 */
export type PipelineApproval = { kind: "human"; actor: string; scenarioIds: string[] } | { kind: "auto" };

export function isFullyAutomatic(db: Db, config: Config): boolean {
  return getPlatformSettings(db, config).approvalMode === "fully_automatic";
}

/**
 * Takes a requirement the rest of the way: approve scenarios → Planner →
 * send grounded plans to generation → Generator → approve → commit → run.
 * Every step goes through the same functions (and gates/audit log) the
 * per-step buttons use. Picks up from wherever the requirement already is,
 * so it also serves as "continue" and "re-run tests".
 */
async function runPipeline(db: Db, config: Config, requirementId: string, approval: PipelineApproval, appUrl: string): Promise<void> {
  const state = pipelines.get(requirementId)!;
  const step = (stage: PipelineStage, message: string) => Object.assign(state, { stage, message });
  const actor = approval.kind === "human" ? approval.actor : "system";
  const actorType = approval.kind === "human" ? "human" : "system_auto";

  step("approving", "Approving scenarios");
  const selected = approval.kind === "human" ? new Set(approval.scenarioIds) : null;
  for (const s of activeScenarios(db, requirementId)) {
    if (s.status === "ai_proposed" && (!selected || selected.has(s.id))) approveScenario(db, s.id, actor, actorType);
  }

  let planned = false;
  if (activeScenarios(db, requirementId).some((s) => s.status === "approved")) {
    step("planning", "Planner is exploring the live app and grounding the approved scenarios");
    await runPlannerAgent(db, config, requirementId, appUrl);
    planned = true;
  }
  for (const s of activeScenarios(db, requirementId)) {
    if (s.status === "grounded_pending_review") approveScenario(db, s.id, actor, actorType);
  }
  const readyForGeneration = activeScenarios(db, requirementId).some((s) => s.status === "approved_for_generation");

  let file = latestTestFile(db, requirementId);
  const needsGeneration = planned || !file || file.status === "rejected" || file.status === "syntax_invalid";
  if (needsGeneration) {
    if (!readyForGeneration) {
      throw new Error(
        planned
          ? "The Planner did not produce a grounded plan for any scenario - check Agent Activity (is Chrome/Playwright available to the server?)."
          : "No approved scenarios to plan or generate from - approve at least one scenario first."
      );
    }
    // A generated file that fails the deterministic syntax/locator check is
    // regenerated (up to Settings → max retries) before giving up - the LLM
    // usually fixes it on a second pass, and an invalid file can't be committed.
    const { maxRetries } = getPlatformSettings(db, config);
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      step("generating", attempt === 0 ? "Generating Playwright tests" : `Regenerating Playwright tests (attempt ${attempt + 1}) - the last version failed validation`);
      const testFileId = await runGeneratorAgent(db, config, requirementId, appUrl);
      file = db.select().from(testFiles).where(eq(testFiles.id, testFileId)).get();
      if (file?.status !== "syntax_invalid") break;
    }
  }
  if (!file) throw new Error("No generated test file found.");
  state.testFileId = file.id;

  if (file.status === "syntax_invalid") {
    throw new Error(`The generated test failed validation, so it was not committed: ${file.validationError ?? "unknown error"}. Regenerate it from the test card below.`);
  }
  if (file.status === "syntax_valid") approveTestFile(db, file.id, actor, actorType);

  if (db.select({ status: testFiles.status }).from(testFiles).where(eq(testFiles.id, file.id)).get()?.status === "approved") {
    step("committing", "Committing the test to the managed tests repo");
    const requirement = db.select({ title: requirements.title }).from(requirements).where(eq(requirements.id, requirementId)).get();
    await commitApprovedTestFiles(db, config, [file.id], `Add generated tests for: ${requirement?.title ?? requirementId}`, actor);
  }

  step("running", "Running the Playwright tests");
  state.testRunId = await runPlaywrightTest(db, config, file.id, approval.kind === "auto" ? "auto_after_commit" : "manual", appUrl);
  step("done", "Pipeline finished - see the test run below");
}

function beginPipeline(db: Db, requirementId: string): PipelineState {
  if (isPipelineRunning(requirementId)) throw new Error("The pipeline is already running for this requirement");
  const requirement = db.select({ id: requirements.id }).from(requirements).where(eq(requirements.id, requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${requirementId} not found`);
  const state: PipelineState = { requirementId, stage: "approving", message: "Starting", startedAt: new Date().toISOString() };
  pipelines.set(requirementId, state);
  return state;
}

/**
 * Runs the pipeline to completion and resolves with its final state (never
 * rejects - a failure is recorded on the state, like the fire-and-forget
 * version). Used by the auto flows, which run requirements one after another.
 */
export async function runRequirementPipeline(db: Db, config: Config, requirementId: string, approval: PipelineApproval, appUrl: string): Promise<PipelineState> {
  const state = beginPipeline(db, requirementId);
  try {
    await runPipeline(db, config, requirementId, approval, appUrl);
  } catch (err) {
    Object.assign(state, { stage: "failed", message: "Failed", error: err instanceof Error ? err.message : String(err) });
    console.error(`Pipeline failed for requirement ${requirementId}:`, err);
  } finally {
    state.finishedAt = new Date().toISOString();
  }
  return state;
}

export function startRequirementPipeline(db: Db, config: Config, requirementId: string, scenarioIds: string[], actor: string, appUrl: string): PipelineState {
  const state = beginPipeline(db, requirementId);
  runPipeline(db, config, requirementId, { kind: "human", actor, scenarioIds }, appUrl)
    .catch((err) => {
      Object.assign(state, { stage: "failed", message: "Failed", error: err instanceof Error ? err.message : String(err) });
      console.error(`Pipeline failed for requirement ${requirementId}:`, err);
    })
    .finally(() => {
      state.finishedAt = new Date().toISOString();
    });
  return state;
}
