import { Router } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements } from "../db/schema.js";
import { runPlannerAgent, getLatestExplorationRun } from "../agents/plannerAgent.js";

export function planRouter(db: Db, config: Config): Router {
  const router = Router();

  router.post("/requirements/:id/plan", (req, res) => {
    const requirement = db.select().from(requirements).where(eq(requirements.id, req.params.id)).get();
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    runPlannerAgent(db, config, req.params.id).catch((err) => {
      console.error(`Planner agent failed for requirement ${req.params.id}:`, err);
    });
    res.status(202).json({ status: "planning" });
  });

  router.get("/requirements/:id/exploration", (req, res) => {
    const row = getLatestExplorationRun(db, req.params.id);
    if (!row) {
      res.status(404).json({ error: "No exploration run yet for this requirement" });
      return;
    }
    res.json(row);
  });

  return router;
}
