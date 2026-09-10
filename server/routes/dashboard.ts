import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { requirements, scenarios, testFiles, gitCommits, agentRuns, testRuns, testRunCases, type RequirementStatus } from "../db/schema.js";

const PIPELINE_STAGES: { key: string; label: string; statuses: RequirementStatus[] }[] = [
  { key: "requirement", label: "Requirement", statuses: ["submitted"] },
  { key: "ai_analysis", label: "AI Analysis", statuses: ["analyzing"] },
  { key: "scenarios", label: "Scenarios", statuses: ["awaiting_scenario_approval"] },
  { key: "planner", label: "Planner", statuses: ["planning"] },
  { key: "plan_approval", label: "Approval", statuses: ["awaiting_plan_approval"] },
  { key: "generator", label: "Generator", statuses: ["generating_tests"] },
  { key: "test_approval", label: "Test Code", statuses: ["awaiting_test_approval"] },
  { key: "git", label: "Git", statuses: ["committed"] },
];

export function dashboardRouter(db: Db): Router {
  const router = Router();

  router.get("/summary", (_req, res) => {
    const allRequirements = db.select().from(requirements).where(eq(requirements.isDeleted, false)).all();
    const allScenarios = db.select().from(scenarios).where(eq(scenarios.isDeleted, false)).all();
    const allTestFiles = db.select().from(testFiles).where(eq(testFiles.isLatest, true)).all();
    const allCommits = db.select().from(gitCommits).all();
    const allAgentRuns = db.select().from(agentRuns).all();
    const allTestRuns = db.select().from(testRuns).all();
    const allBugCases = db.select().from(testRunCases).where(eq(testRunCases.classification, "REAL_DEFECT")).all();

    const pipeline = PIPELINE_STAGES.map((stage) => ({
      key: stage.key,
      label: stage.label,
      count: allRequirements.filter((r) => (stage.statuses as string[]).includes(r.status)).length,
    }));
    // "Ready for CI/CD" = requirements whose latest test file is committed but nothing further exists yet in Phase 1.
    pipeline.push({
      key: "ready_for_cicd",
      label: "Ready for CI/CD",
      count: allRequirements.filter((r) => r.status === "committed").length,
    });

    res.json({
      totalRequirements: allRequirements.length,
      requirementsInProgress: allRequirements.filter((r) => r.status !== "committed" && r.status !== "failed").length,
      requirementsFailed: allRequirements.filter((r) => r.status === "failed").length,
      scenariosGenerated: allScenarios.length,
      scenariosAwaitingApproval: allScenarios.filter((s) => s.status === "ai_proposed" || s.status === "grounded_pending_review").length,
      testsGenerated: allTestFiles.length,
      testsApproved: allTestFiles.filter((f) => f.status === "approved" || f.status === "committed").length,
      testsCommitted: allTestFiles.filter((f) => f.status === "committed").length,
      commitsTotal: allCommits.length,
      agentJobsRunning: allAgentRuns.filter((r) => r.status === "running" || r.status === "queued").length,
      agentJobsFailed: allAgentRuns.filter((r) => r.status === "failed").length,
      testRunsTotal: allTestRuns.length,
      testRunsPassed: allTestRuns.filter((r) => r.status === "passed").length,
      testRunsFailed: allTestRuns.filter((r) => r.status === "failed" || r.status === "error").length,
      testRunsInProgress: allTestRuns.filter((r) => r.status === "running").length,
      bugsFound: allBugCases.length,
      pipeline,
    });
  });

  return router;
}
