import { Router } from "express";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import type { URLConfigService } from "../config/urlConfigService.js";
import { resolveTargetAppUrl } from "../config/targetAppUrl.js";
import { isCodeFeatureBatchRunning, listCodeFeatures, runCodeFeatureBatch } from "../agents/codeFeatureAnalysis.js";
import { getPipelineState, startRequirementPipeline } from "../agents/requirementPipeline.js";

/**
 * Additions to the Code Analysis page that sit next to (not inside) the
 * module scan in routes/codeAnalysis.ts: source-derived cross-cutting
 * features (Theme, Action Buttons, Status, Navigation) and the one-click
 * approve → plan → generate → commit → run pipeline for any requirement.
 */
export function codeAnalysisWorkflowRouter(db: Db, config: Config, urlConfigService?: URLConfigService): Router {
  const router = Router();

  router.get("/features", (_req, res) => {
    res.json({ features: listCodeFeatures(db, config), running: isCodeFeatureBatchRunning() });
  });

  router.post("/features/run", (req, res) => {
    if (isCodeFeatureBatchRunning()) {
      res.status(409).json({ error: "A code feature analysis run is already in progress" });
      return;
    }
    // Fire-and-forget like the module batch - the client polls GET /features.
    runCodeFeatureBatch(db, config, { force: req.body?.force === true }).catch((err) => {
      console.error("Code feature analysis batch failed:", err);
    });
    res.status(202).json({ status: "running" });
  });

  router.get("/pipeline/:requirementId", (req, res) => {
    res.json(getPipelineState(req.params.requirementId));
  });

  router.post("/pipeline/:requirementId", (req, res) => {
    const scenarioIds = Array.isArray(req.body?.scenarioIds) ? req.body.scenarioIds.filter((s: unknown): s is string => typeof s === "string") : [];
    const actor = typeof req.body?.actor === "string" && req.body.actor.trim() ? req.body.actor.trim() : "unknown";
    try {
      // The Planner and the test run target the configured app (Settings →
      // URL profile → APP_BASE_URL), exactly as the per-step buttons do.
      res.status(202).json(startRequirementPipeline(db, config, req.params.requirementId, scenarioIds, actor, resolveTargetAppUrl(db, config, urlConfigService)));
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
