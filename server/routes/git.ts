import { Router } from "express";
import { desc } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { gitCommits } from "../db/schema.js";
import { getRepoStatus, getCommitHistory, commitApprovedTestFiles } from "../git/managedRepo.js";

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
      const dbCommits = db.select().from(gitCommits).orderBy(desc(gitCommits.committedAt)).limit(limit).all();
      const rawLog = await getCommitHistory(config, limit);
      res.json({ commits: dbCommits, rawLog });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/commit", async (req, res) => {
    const { testFileIds, message, author } = req.body ?? {};
    if (!Array.isArray(testFileIds) || testFileIds.length === 0) {
      res.status(400).json({ error: "testFileIds (non-empty array) is required" });
      return;
    }
    if (typeof message !== "string" || !message.trim()) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    try {
      const result = await commitApprovedTestFiles(db, config, testFileIds, message, typeof author === "string" ? author : "unknown");
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
