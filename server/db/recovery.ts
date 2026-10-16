import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { agentRuns, requirements, scenarios, testRuns } from "./schema.js";

const INTERRUPTED = "Interrupted: the platform server stopped while this was in progress. Run it again.";

/**
 * Agents and test runs are in-process and fire-and-forget, so a server
 * restart mid-run leaves rows saying "running" forever: test runs the
 * dashboard polls endlessly, scenarios stuck in grounding_in_progress that
 * neither the Planner nor auto mode will pick up again. Nothing can still be
 * running at startup, so put each back where it can be retried.
 */
export function recoverInterruptedWork(db: Db): void {
  const now = new Date();
  const runs = db.update(testRuns).set({ status: "error", errorMessage: INTERRUPTED, finishedAt: now }).where(eq(testRuns.status, "running")).returning({ id: testRuns.id }).all();
  const agents = db.update(agentRuns).set({ status: "failed", errorMessage: INTERRUPTED, finishedAt: now }).where(eq(agentRuns.status, "running")).returning({ id: agentRuns.id }).all();
  db.update(scenarios).set({ status: "approved", updatedAt: now }).where(eq(scenarios.status, "grounding_in_progress")).run();
  // An interrupted first analysis failed; an interrupted RE-analysis of a screen that
  // already had one keeps that earlier analysis, so it goes back to review.
  db.update(requirements).set({ status: "awaiting_scenario_approval", updatedAt: now }).where(and(eq(requirements.status, "analyzing"), isNotNull(requirements.currentAnalysisId))).run();
  db.update(requirements).set({ status: "failed", updatedAt: now }).where(eq(requirements.status, "analyzing")).run();
  db.update(requirements).set({ status: "awaiting_scenario_approval", updatedAt: now }).where(eq(requirements.status, "planning")).run();
  db.update(requirements).set({ status: "awaiting_plan_approval", updatedAt: now }).where(eq(requirements.status, "generating_tests")).run();
  if (runs.length || agents.length) {
    console.log(`Recovered ${runs.length} interrupted test run(s) and ${agents.length} agent run(s) from the previous server session.`);
  }

  // Scenarios created before they inherited their requirement's application
  // were invisible under Test Case Management - attribute them once.
  db.update(scenarios)
    .set({ applicationId: sql`(select ${requirements.applicationId} from ${requirements} where ${requirements.id} = ${scenarios.requirementId})` })
    .where(isNull(scenarios.applicationId))
    .run();
}
