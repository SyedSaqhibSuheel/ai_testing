import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { testFiles, testRuns, testRunCases } from "../db/schema.js";
import { runPlaywrightTest } from "../execution/runTests.js";

export function testRunsRouter(db: Db, config: Config): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const { testFileId } = req.query;
    const rows =
      typeof testFileId === "string"
        ? db.select().from(testRuns).where(eq(testRuns.testFileId, testFileId)).orderBy(desc(testRuns.startedAt)).all()
        : db.select().from(testRuns).orderBy(desc(testRuns.startedAt)).limit(100).all();
    res.json(rows);
  });

  router.get("/:id", (req, res) => {
    const run = db.select().from(testRuns).where(eq(testRuns.id, req.params.id)).get();
    if (!run) {
      res.status(404).json({ error: "Test run not found" });
      return;
    }
    const cases = db.select().from(testRunCases).where(eq(testRunCases.testRunId, run.id)).all();
    res.json({ run, cases });
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
