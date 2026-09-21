import { Router } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import {
  testFiles,
  testRuns,
  testRunCases,
  testFileScenarios,
  scenarios,
} from "../db/schema.js";
import { runPlaywrightTest } from "../execution/runTests.js";

export function testRunsRouter(db: Db, config: Config): Router {
  const router = Router();

  router.get("/", (req, res) => {
  const { testFileId, applicationId } = req.query;

  let rows =
    typeof testFileId === "string"
      ? db
          .select()
          .from(testRuns)
          .where(eq(testRuns.testFileId, testFileId))
          .orderBy(desc(testRuns.startedAt))
          .all()
      : db
          .select()
          .from(testRuns)
          .orderBy(desc(testRuns.startedAt))
          .limit(100)
          .all();

  if (typeof applicationId === "string") {
    const matchingTestFiles = db
      .select({ testFileId: testFileScenarios.testFileId })
      .from(testFileScenarios)
      .innerJoin(
        scenarios,
        eq(testFileScenarios.scenarioId, scenarios.id),
      )
      .where(eq(scenarios.applicationId, applicationId))
      .all();

    const matchingTestFileIds = matchingTestFiles.map(
      (row) => row.testFileId,
    );

    rows = rows.filter((run) =>
      matchingTestFileIds.includes(run.testFileId),
    );
  }

  const enrichedRows = rows.map((run) => {
  const testCases = db
    .select({
      testCaseId: testFileScenarios.scenarioId,
      testTitle: testFileScenarios.testTitle,
      scenarioTitle: scenarios.title,
    })
    .from(testFileScenarios)
    .innerJoin(
      scenarios,
      eq(testFileScenarios.scenarioId, scenarios.id),
    )
    .where(eq(testFileScenarios.testFileId, run.testFileId))
    .all();

  return {
    ...run,
    testCases,
  };
});

res.json(enrichedRows);
});

  router.get("/:id", (req, res) => {
  const run = db
    .select()
    .from(testRuns)
    .where(eq(testRuns.id, req.params.id))
    .get();

  if (!run) {
    res.status(404).json({ error: "Test run not found" });
    return;
  }

  const cases = db
    .select()
    .from(testRunCases)
    .where(eq(testRunCases.testRunId, run.id))
    .all();

  const testCases = db
    .select({
      id: testFileScenarios.id,
      testCaseId: testFileScenarios.scenarioId,
      title: testFileScenarios.testTitle,
      scenarioTitle: scenarios.title,
    })
    .from(testFileScenarios)
    .innerJoin(
      scenarios,
      eq(testFileScenarios.scenarioId, scenarios.id),
    )
    .where(eq(testFileScenarios.testFileId, run.testFileId))
    .all();

  res.json({
    run,
    cases,
    testCases,
  });
});

  return router;
}

/** Mounted at /api/test-files so the route reads naturally as "run this test file". */
export function runTestRouter(db: Db, config: Config): Router {
  const router = Router();

  router.post("/:id/run", (req, res) => {
    const file = db.select().from(testFiles).where(eq(testFiles.id, req.params.id)).get();
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    // Fire-and-forget, matching every other agent trigger in this app - the
    // client polls GET /api/test-runs?testFileId=... for the new run.
    runPlaywrightTest(db, config, req.params.id, "manual").catch((err) => {
      console.error(`Manual test run failed for test file ${req.params.id}:`, err);
    });
    res.status(202).json({ status: "running" });
  });

  return router;
}
