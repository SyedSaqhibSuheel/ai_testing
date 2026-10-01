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
 * One click from the Code Analysis page takes a requirement the rest of the
 * way: approve the chosen scenarios → Planner → send grounded plans to
 * generation → Generator → approve → commit → run. Every step goes through
 * the same functions (and gates/audit log) the per-step buttons use; the
 * human who clicked is recorded as the approver, since the click is their
 * explicit sign-off for the whole chain. Picks up from wherever the
 * requirement already is, so it also serves as "continue" and "re-run tests".
 */
async function runPipeline(db: Db, config: Config, requirementId: string, scenarioIds: string[], actor: string, appUrl: string): Promise<void> {
  const state = pipelines.get(requirementId)!;
  const step = (stage: PipelineStage, message: string) => Object.assign(state, { stage, message });

  step("approving", "Approving scenarios");
  const selected = new Set(scenarioIds);
  for (const s of activeScenarios(db, requirementId)) {
    if (s.status === "ai_proposed" && selected.has(s.id)) approveScenario(db, s.id, actor, "human");
  }

  let planned = false;
  if (activeScenarios(db, requirementId).some((s) => s.status === "approved")) {
    step("planning", "Planner is exploring the live app and grounding the approved scenarios");
    await runPlannerAgent(db, config, requirementId, appUrl);
    planned = true;
  }
  for (const s of activeScenarios(db, requirementId)) {
    if (s.status === "grounded_pending_review") approveScenario(db, s.id, actor, "human");
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
    step("generating", "Generating Playwright tests");
    const testFileId = await runGeneratorAgent(db, config, requirementId, appUrl);
    file = db.select().from(testFiles).where(eq(testFiles.id, testFileId)).get();
  }
  if (!file) throw new Error("No generated test file found.");
  state.testFileId = file.id;

  if (file.status === "syntax_invalid") {
    throw new Error(`The generated test failed validation, so it was not committed: ${file.validationError ?? "unknown error"}. Regenerate it from the test card below.`);
  }
  if (file.status === "syntax_valid") approveTestFile(db, file.id, actor, "human");

  if (db.select({ status: testFiles.status }).from(testFiles).where(eq(testFiles.id, file.id)).get()?.status === "approved") {
    step("committing", "Committing the test to the managed tests repo");
    const requirement = db.select({ title: requirements.title }).from(requirements).where(eq(requirements.id, requirementId)).get();
    await commitApprovedTestFiles(db, config, [file.id], `Add generated tests for: ${requirement?.title ?? requirementId}`, actor);
  }

  step("running", "Running the Playwright tests");
  state.testRunId = await runPlaywrightTest(db, config, file.id, "manual", appUrl);
  step("done", "Pipeline finished - see the test run below");
}

export function startRequirementPipeline(db: Db, config: Config, requirementId: string, scenarioIds: string[], actor: string, appUrl: string): PipelineState {
  if (isPipelineRunning(requirementId)) throw new Error("The pipeline is already running for this requirement");
  const requirement = db.select({ id: requirements.id }).from(requirements).where(eq(requirements.id, requirementId)).get();
  if (!requirement) throw new Error(`Requirement ${requirementId} not found`);

  const state: PipelineState = { requirementId, stage: "approving", message: "Starting", startedAt: new Date().toISOString() };
  pipelines.set(requirementId, state);
  runPipeline(db, config, requirementId, scenarioIds, actor, appUrl)
    .catch((err) => {
      Object.assign(state, { stage: "failed", message: "Failed", error: err instanceof Error ? err.message : String(err) });
      console.error(`Pipeline failed for requirement ${requirementId}:`, err);
    })
    .finally(() => {
      state.finishedAt = new Date().toISOString();
    });
  return state;
}
