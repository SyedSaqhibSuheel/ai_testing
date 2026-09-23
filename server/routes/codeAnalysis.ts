import { Router } from "express";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { listCodeModules, isCodeAnalysisBatchRunning, runCodeAnalysisBatch } from "../agents/codeAnalysisAgent.js";

export function codeAnalysisRouter(db: Db, config: Config): Router {
  const router = Router();

  router.get("/modules", (req, res) => {
    const modules = listCodeModules(db, config);
    res.json({ modules, running: isCodeAnalysisBatchRunning() });
  });

  router.post("/run", (req, res) => {
    if (isCodeAnalysisBatchRunning()) {
      res.status(409).json({ error: "A code analysis run is already in progress" });
      return;
    }
    const force = req.body?.force === true;
    // Fire-and-forget: analyzing every module is many sequential real LLM
    // calls, so the client polls GET /modules (and Requirements/Agent
    // Activity, which fill in live as each module completes) for progress.
    runCodeAnalysisBatch(db, config, { force }).catch((err) => {
      console.error("Code analysis batch failed:", err);
    });
    res.status(202).json({ status: "running" });
  });

  return router;
}
