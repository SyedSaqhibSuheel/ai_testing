import { Router } from "express";
import { desc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, testFiles, testRuns } from "../db/schema.js";
import { resolveRunWebsite } from "../utils/websiteResolver.js";

// Cross-requirement, execution-level history feed for the "Test History" page:
// Website -> Date -> Test Case -> Execution. Built by composing the existing
// test_runs/test_files/requirements tables in JS (same style as
// requirements.ts's GET /:id) rather than a SQL join, since that's the
// established pattern in this codebase and keeps each query trivial to read.
//
// "Test case" == a requirement (stable id/title across test-file
// regenerations), matching how RequirementDetail.tsx already groups a
// requirement's CI/CD run history.
export interface TestHistoryEntry {
  testRunId: string;
  testFileId: string;
  requirementId: string;
  testCaseName: string;
  filePath: string;
  website: string;
  appUrl: string | null;
  isLatestFile: boolean;
  fileStatus: string;
  status: string;
  triggeredBy: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  totalTests: number | null;
  passedCount: number | null;
  failedCount: number | null;
  skippedCount: number | null;
  errorMessage: string | null;
}

const HISTORY_LIMIT = 1000;

export function testHistoryRouter(db: Db, _config: Config): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    const runs = db.select().from(testRuns).orderBy(desc(testRuns.startedAt)).limit(HISTORY_LIMIT).all();
    const files = db.select().from(testFiles).all();
    const reqs = db.select().from(requirements).all();

    const fileById = new Map(files.map((f) => [f.id, f]));
    const requirementById = new Map(reqs.map((r) => [r.id, r]));

    const entries: TestHistoryEntry[] = [];
    for (const run of runs) {
      const file = fileById.get(run.testFileId);
      if (!file) continue; // orphaned row - shouldn't happen, but don't blow up the whole feed
      const requirement = requirementById.get(file.requirementId);
      if (!requirement || requirement.isDeleted) continue;

      entries.push({
        testRunId: run.id,
        testFileId: file.id,
        requirementId: requirement.id,
        testCaseName: requirement.title,
        filePath: file.filePath,
        website: resolveRunWebsite(run.appUrl, file.code),
        appUrl: run.appUrl,
        isLatestFile: file.isLatest,
        fileStatus: file.status,
        status: run.status,
        triggeredBy: run.triggeredBy,
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt ? run.finishedAt.toISOString() : null,
        durationMs: run.durationMs,
        totalTests: run.totalTests,
        passedCount: run.passedCount,
        failedCount: run.failedCount,
        skippedCount: run.skippedCount,
        errorMessage: run.errorMessage,
      });
    }

    res.json(entries);
  });

  return router;
}
