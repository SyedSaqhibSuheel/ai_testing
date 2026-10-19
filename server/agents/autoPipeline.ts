import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements } from "../db/schema.js";
import { resolveAppConfig } from "../config/activeApplication.js";
import { resolveTargetAppUrl } from "../config/targetAppUrl.js";
import { runIntelligenceAgent } from "./intelligenceAgent.js";
import { isCodeAnalysisBatchRunning, runCodeAnalysisBatch } from "./codeAnalysisAgent.js";
import { isCodeFeatureBatchRunning, runCodeFeatureBatch } from "./codeFeatureAnalysis.js";
import { getPlatformSettings } from "../settings/settingsService.js";
import { getPipelineState, isFullyAutomatic, isPipelineRunning, runRequirementPipeline, type PipelineState } from "./requirementPipeline.js";

/**
 * Each agent already auto-approves its own gate when the approval mode says
 * so, but nothing used to start the NEXT agent - so scenarios were
 * auto-approved and then sat there. These entry points chain the lifecycle and
 * follow the mode from Settings: Fully Automatic runs everything, Semi-Automatic
 * stops for scenario and plan approval (then generates, commits and runs by
 * itself), Manual stops after analysis. A stopped requirement is "waiting", not failed.
 */

/**
 * Requirements page: a submitted requirement is analyzed into test cases
 * straight away (any mode - generating draft scenarios is not a gate), and
 * in Fully Automatic mode carried on through plan → generate → commit → run.
 */
export async function analyzeRequirementAndContinue(db: Db, config: Config, requirementId: string, appUrl: string): Promise<void> {
  await runIntelligenceAgent(db, config, requirementId, appUrl);
  if (!isFullyAutomatic(db, config) || isPipelineRunning(requirementId)) return; // other modes stop at their human gates
  await runRequirementPipeline(db, config, requirementId, { kind: "auto" }, appUrl);
}

const approvalLabel = (mode: string) => mode.replace(/_/g, "-");

export type AutoRunStage = "analyzing" | "testing" | "done" | "failed";

export interface AutoRunState {
  applicationId?: string;
  stage: AutoRunStage;
  message: string;
  /** Requirements the testing phase works through, and how far it got. */
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  /** Requirements stopped at a gate the approval mode leaves to a human. */
  waiting: number;
  mode: string;
  currentRequirementId?: string;
  /** The in-flight pipeline of currentRequirementId (stage + what it's doing), added when read. */
  current?: PipelineState | null;
  /** Requirements the testing phase will work through, in order. */
  queue: string[];
  /** What happened to each requirement already worked through. */
  results: Record<string, "done" | "waiting" | "failed">;
  failures: Array<{ requirementId: string; title: string; error: string }>;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

// In-memory like the other batch flags; the durable record is the
// requirements, test files, commits and test runs it writes.
let autoRun: AutoRunState | null = null;

export function getAutoRunState(): AutoRunState | null {
  if (!autoRun) return null;
  return { ...autoRun, current: autoRun.currentRequirementId ? getPipelineState(autoRun.currentRequirementId) : null };
}

export function isAutoRunRunning(): boolean {
  return !!autoRun && (autoRun.stage === "analyzing" || autoRun.stage === "testing");
}

// Statuses an analyzed requirement can carry on from. "failed" is excluded:
// a requirement whose analysis failed has nothing to test (the analysis
// batch at the start of every auto run retries those).
const CONTINUABLE = ["awaiting_scenario_approval", "planning", "awaiting_plan_approval", "generating_tests", "awaiting_test_approval", "committed"] as const;

/**
 * Code Analysis page, one click: analyze every screen and cross-cutting
 * behaviour of the active application, then for each resulting requirement
 * plan, generate, commit and run its tests, one requirement at a time (they
 * share the app, its login session and its data). Results land as normal
 * test runs, so they show up under Test Case Management for the application.
 */
export interface AutoRunOptions {
  /** Re-analyze screens that were already analyzed. */
  force?: boolean;
  /** Skip analysis and go straight to generate → commit → run ("Save & Run All"). */
  skipAnalysis?: boolean;
}

export function startAutoRun(db: Db, config: Config, opts: AutoRunOptions = {}): AutoRunState {
  if (isAutoRunRunning()) throw new Error("A full auto run is already in progress");
  if (isCodeAnalysisBatchRunning() || isCodeFeatureBatchRunning()) throw new Error("A code analysis run is already in progress - wait for it to finish");

  const resolved = resolveAppConfig(db, config);
  const state: AutoRunState = {
    applicationId: resolved.applicationId,
    stage: opts.skipAnalysis ? "testing" : "analyzing",
    message: opts.skipAnalysis ? "Collecting requirements to test" : "Analyzing the application's screens and behaviours",
    total: 0,
    completed: 0,
    succeeded: 0,
    failed: 0,
    waiting: 0,
    queue: [],
    results: {},
    mode: getPlatformSettings(db, config).approvalMode,
    failures: [],
    startedAt: new Date().toISOString(),
  };
  autoRun = state;

  runAutoRun(db, config, state, opts)
    .catch((err) => {
      Object.assign(state, { stage: "failed", message: "Failed", error: err instanceof Error ? err.message : String(err) });
      console.error("Full auto run failed:", err);
    })
    .finally(() => {
      state.finishedAt = new Date().toISOString();
    });
  return state;
}

async function runAutoRun(db: Db, config: Config, state: AutoRunState, opts: AutoRunOptions): Promise<void> {
  // Modules first, then the cross-cutting features (the feature batch waits
  // for the module batch anyway). Each skips what's already analyzed unless
  // forced, and retries what failed.
  if (!opts.skipAnalysis) {
    await runCodeAnalysisBatch(db, config, { force: opts.force });
    await runCodeFeatureBatch(db, config, { force: opts.force });
  }

  const appUrl = resolveTargetAppUrl(db, config);
  const allRows = db
    .select({ id: requirements.id, title: requirements.title, status: requirements.status, sourceModule: requirements.sourceModule, createdAt: requirements.createdAt })
    .from(requirements)
    .where(
      and(
        eq(requirements.source, "code_analysis"),
        eq(requirements.isDeleted, false),
        inArray(requirements.status, [...CONTINUABLE]),
        state.applicationId ? eq(requirements.applicationId, state.applicationId) : undefined
      )
    )
    .all()
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  // One requirement per screen/behaviour: re-analysis leaves older requirements
  // for the same source module behind, and only the latest is what the page
  // lists. Testing the superseded ones would duplicate work and tests.
  const latest = new Map<string, (typeof allRows)[number]>();
  for (const r of allRows) latest.set(r.sourceModule ?? r.id, r);
  const rows = [...latest.values()];

  // Manual mode: every gate is a human's, so after analysis there is nothing
  // to run on their behalf - report what's waiting for approval and stop.
  if (state.mode === "manual") {
    state.waiting = rows.filter((r) => r.status === "awaiting_scenario_approval").length;
    state.total = rows.length;
    Object.assign(state, {
      stage: "done",
      completed: rows.length,
      message: `Analysis finished: ${state.waiting} requirement${state.waiting === 1 ? "" : "s"} waiting for your approval (manual mode)`,
    });
    return;
  }

  state.queue = rows.map((r) => r.id);
  Object.assign(state, { stage: "testing", total: rows.length, message: `Generating and running tests for ${rows.length} requirement${rows.length === 1 ? "" : "s"}` });
  for (const row of rows) {
    state.currentRequirementId = row.id;
    state.message = `Testing ${state.completed + 1} of ${rows.length}: ${row.title}`;
    if (isPipelineRunning(row.id)) {
      // Someone started this one by hand meanwhile - leave it to that run.
      state.completed++;
      state.results[row.id] = "waiting";
      continue;
    }
    const result = await runRequirementPipeline(db, config, row.id, { kind: "auto" }, appUrl);
    state.completed++;
    state.results[row.id] = result.stage === "done" ? "done" : result.stage === "waiting" ? "waiting" : "failed";
    if (result.stage === "done") state.succeeded++;
    else if (result.stage === "waiting") state.waiting++;
    else {
      state.failed++;
      state.failures.push({ requirementId: row.id, title: row.title, error: result.error ?? "Unknown error" });
    }
  }

  state.currentRequirementId = undefined;
  Object.assign(state, {
    stage: "done",
    message:
      `Finished: ${state.succeeded} of ${state.total} requirement${state.total === 1 ? "" : "s"} tested` +
      (state.waiting ? `, ${state.waiting} waiting for your approval (${approvalLabel(state.mode)} mode)` : "") +
      (state.failed ? `, ${state.failed} could not be completed` : ""),
  });
}
