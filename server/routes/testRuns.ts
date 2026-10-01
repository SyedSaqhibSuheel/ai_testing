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
import type { URLConfigService } from "../config/urlConfigService.js";
import { getPlatformSettings } from "../settings/settingsService.js";

export function testRunsRouter(db: Db, config: Config, urlConfigService?: URLConfigService): Router {
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
export function runTestRouter(db: Db, config: Config, urlConfigService?: URLConfigService): Router {
  const router = Router();

  router.post("/:id/run", (req, res) => {
    const file = db.select().from(testFiles).where(eq(testFiles.id, req.params.id)).get();
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    // Resolve the app URL to run against. Preferred source: the DB-persisted
    // testAppUrl setting (same one the Generator and Planner use). The
    // urlConfigService "active profile" is in-memory only - it resets to
    // "default" (localhost) on every server restart - so it's just a
    // last-resort fallback, never allowed to override an explicit testAppUrl.
    const settings = getPlatformSettings(db, config);
    const activeUrlConfig = urlConfigService ? urlConfigService.getActiveConfig() : { appBaseUrl: config.appBaseUrl };
    const targetAppUrl = settings.testAppUrl || activeUrlConfig.appBaseUrl;
    // Fire-and-forget, matching every other agent trigger in this app - the
    // client polls GET /api/test-runs?testFileId=... for the new run.
    runPlaywrightTest(db, config, req.params.id, "manual", targetAppUrl).catch((err) => {
      console.error(`Manual test run failed for test file ${req.params.id}:`, err);
    });
    res.status(202).json({ status: "running" });
  });

  router.post("/run-all", async (_req, res) => {
  try {
    const files = db
      .select()
      .from(testFiles)
      .where(eq(testFiles.isLatest, true))
      .all()
      .filter((file) => file.status === "committed");

    if (files.length === 0) {
      res.status(400).json({
        error: "No committed test files are available to run.",
      });
      return;
    }

    const settings = getPlatformSettings(db, config);
    const activeUrlConfig = urlConfigService
      ? urlConfigService.getActiveConfig()
      : { appBaseUrl: config.appBaseUrl };

    const targetAppUrl =
      settings.testAppUrl || activeUrlConfig.appBaseUrl;

    // Fire-and-forget, matching every other agent/test trigger in this app
    // (see the single-file /:id/run route above) - each run is a real
    // Playwright process that can take anywhere from seconds to a minute+,
    // so awaiting all of them here before responding would leave the
    // request hanging for however long the slowest of N files takes. The
    // client polls GET /api/test-runs?testFileId=... per file for results.
    for (const file of files) {
      runPlaywrightTest(db, config, file.id, "manual", targetAppUrl).catch((err) => {
        console.error(`Run-all: test run failed for test file ${file.id}:`, err);
      });
    }

    res.status(202).json({
      status: "running",
      testFileCount: files.length,
    });
  } catch (error) {
    console.error("Run all tests failed:", error);

    res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "Failed to run all tests",
    });
  }
});
  return router;
}
