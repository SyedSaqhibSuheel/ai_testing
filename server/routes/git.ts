import { Router } from "express";
import { desc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { gitCommits } from "../db/schema.js";
import { getRepoStatus, getCommitHistory, commitApprovedTestFiles, triggerAutoRunForCommittedFiles } from "../git/managedRepo.js";

export function gitRouter(db: Db, config: Config): Router {
  const router = Router();

  router.get("/status", async (_req, res) => {
    try {
      res.json(await getRepoStatus(config));
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/commits", async (req, res) => {
    try {
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      // Prefer our DB record (has the requirement/test-file traceability the
      // dashboard needs) but fall back to raw git log for repo-level history.
      const dbCommits = await db.select().from(gitCommits).orderBy(desc(gitCommits.committedAt)).limit(limit);
      const rawLog = await getCommitHistory(config, limit);
      res.json({ commits: dbCommits, rawLog });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/commit", async (req, res) => {
    try {
      const { testFileIds, message, author } = req.body ?? {};

      // Validate request body
      if (!testFileIds) {
        return res.status(400).json({ error: "testFileIds field is missing from request body" });
      }
      if (!Array.isArray(testFileIds)) {
        return res.status(400).json({ error: `testFileIds must be an array, got ${typeof testFileIds}` });
      }
      if (testFileIds.length === 0) {
        return res.status(400).json({ error: "testFileIds must contain at least one file ID" });
      }

      if (!message) {
        return res.status(400).json({ error: "message field is missing from request body" });
      }
      if (typeof message !== "string") {
        return res.status(400).json({ error: `message must be a string, got ${typeof message}` });
      }
      if (!message.trim()) {
        return res.status(400).json({ error: "message cannot be empty or whitespace" });
      }

      // Perform commit
      const result = await commitApprovedTestFiles(db, config, testFileIds, message, typeof author === "string" ? author : "unknown");

      // Handle both new commits and already-committed files
      const statusCode = result.status === "already_committed" ? 200 : 201;
      const responseBody = {
        commitSha: result.commitSha,
        filesChanged: result.filesChanged,
        ...(result.status && { status: result.status }),
        message: result.status === "already_committed" ? "Files already committed - no new changes" : "Committed successfully",
      };

      // "Commit to Git -> CI/CD runs the code -> report appears in the
      // dashboard": fire-and-forget so the commit response isn't held up by
      // a real browser test run. The client polls GET /api/test-runs.
      await triggerAutoRunForCommittedFiles(db, config, testFileIds);

      return res.status(statusCode).json(responseBody);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Commit error:", errorMessage);
      return res.status(400).json({ error: errorMessage });
    }
  });

  return router;
}
