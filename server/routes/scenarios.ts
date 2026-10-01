import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { URLConfigService } from "../config/urlConfigService.js";
import { scenarios } from "../db/schema.js";
import { approveScenario, rejectScenario, deleteScenario, editScenario } from "../scenarios/scenarioTransitions.js";
import { regenerateScenario } from "../agents/intelligenceAgent.js";

export function scenariosRouter(db: Db, config: Config, urlConfigService?: URLConfigService): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const { requirementId, applicationId, status } = req.query;
    const conditions = [eq(scenarios.isDeleted, false)];
    if (typeof requirementId === "string") conditions.push(eq(scenarios.requirementId, requirementId));
    if (typeof applicationId === "string") conditions.push(eq(scenarios.applicationId, applicationId));
    if (typeof status === "string") conditions.push(eq(scenarios.status, status as never));
    const rows = await db.select().from(scenarios).where(and(...conditions)).orderBy(desc(scenarios.createdAt));
    res.json(rows);
  });

  router.post("/", async (req, res) => {
    const b = req.body ?? {};
    if (!b.requirementId || !b.title || !b.description || !b.expectedResult) {
      res.status(400).json({ error: "requirementId, title, description, and expectedResult are required" });
      return;
    }
    const actor = typeof b.actor === "string" ? b.actor : "unknown";
    const [row] = await db
      .insert(scenarios)
      .values({
        requirementId: b.requirementId,
        applicationId: typeof b.applicationId === "string" ? b.applicationId : null,
        sourceType: "user_added",
        title: b.title,
        description: b.description,
        priority: b.priority ?? "medium",
        riskLevel: b.riskLevel ?? "medium",
        preconditions: b.preconditions ?? [],
        draftSteps: b.draftSteps ?? [],
        expectedResult: b.expectedResult,
        // A human wrote this directly - it doesn't need the AI-intent gate (G1).
        status: "approved",
        approvedBy: actor,
        approvedAt: new Date(),
      })
      .returning();
    res.status(201).json(row);
  });

  router.get("/:id", async (req, res) => {
    const [row] = await db.select().from(scenarios).where(eq(scenarios.id, req.params.id));
    if (!row) {
      res.status(404).json({ error: "Scenario not found" });
      return;
    }
    res.json(row);
  });

  router.patch("/:id", async (req, res) => {
    try {
      const { actor, ...patch } = req.body ?? {};
      await editScenario(db, req.params.id, patch, typeof actor === "string" ? actor : "unknown");
      const [row] = await db.select().from(scenarios).where(eq(scenarios.id, req.params.id));
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      const actor = typeof req.query.actor === "string" ? req.query.actor : "unknown";
      await deleteScenario(db, req.params.id, actor);
      res.status(204).end();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/:id/approve", async (req, res) => {
    try {
      const actor = typeof req.body?.actor === "string" ? req.body.actor : "unknown";
      await approveScenario(db, req.params.id, actor);
      const [row] = await db.select().from(scenarios).where(eq(scenarios.id, req.params.id));
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/:id/reject", async (req, res) => {
    const { reason, actor } = req.body ?? {};
    if (typeof reason !== "string" || !reason.trim()) {
      res.status(400).json({ error: "reason is required to reject a scenario" });
      return;
    }
    try {
      await rejectScenario(db, req.params.id, typeof actor === "string" ? actor : "unknown", reason);
      const [row] = await db.select().from(scenarios).where(eq(scenarios.id, req.params.id));
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/:id/regenerate", async (req, res) => {
    try {
      const { actor, feedback } = req.body ?? {};
      if (!urlConfigService) {
        return res.status(500).json({ error: "URL Config Service not initialized" });
      }
      const activeAppBaseUrl = urlConfigService.getActiveConfig().appBaseUrl;
      const newId = await regenerateScenario(db, config, req.params.id, typeof actor === "string" ? actor : "unknown", feedback, activeAppBaseUrl);
      const [row] = await db.select().from(scenarios).where(eq(scenarios.id, newId));
      res.json(row);
    } catch (err) {
      console.error("[Regenerate Error]", err);
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
