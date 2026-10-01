import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, requirementAnalyses, scenarios } from "../db/schema.js";
import { runIntelligenceAgent } from "../agents/intelligenceAgent.js";
import type { URLConfigService } from "../config/urlConfigService.js";

export function requirementsRouter(db: Db, config: Config, urlConfigService?: URLConfigService): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const rows = await db.select().from(requirements).where(eq(requirements.isDeleted, false)).orderBy(desc(requirements.createdAt));
    res.json(rows);
  });

  router.post("/", async (req, res) => {
    const { title, rawText, submittedBy } = req.body ?? {};
    if (typeof rawText !== "string" || !rawText.trim()) {
      res.status(400).json({ error: "rawText is required" });
      return;
    }
    const [row] = await db
      .insert(requirements)
      .values({
        title: typeof title === "string" && title.trim() ? title.trim() : rawText.slice(0, 80),
        rawText: rawText.trim(),
        submittedBy: typeof submittedBy === "string" && submittedBy.trim() ? submittedBy.trim() : "unknown",
      })
      .returning();
    res.status(201).json(row);
  });

  router.get("/:id", async (req, res) => {
    const [requirement] = await db.select().from(requirements).where(eq(requirements.id, req.params.id));
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    const [analysis] = requirement.currentAnalysisId
      ? await db.select().from(requirementAnalyses).where(eq(requirementAnalyses.id, requirement.currentAnalysisId))
      : [null];
    const scenarioRows = await db
      .select()
      .from(scenarios)
      .where(and(eq(scenarios.requirementId, requirement.id), eq(scenarios.isDeleted, false)))
      .orderBy(desc(scenarios.createdAt));
    res.json({ requirement, analysis, scenarios: scenarioRows });
  });

  router.patch("/:id", async (req, res) => {
    const { title, rawText } = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof title === "string") patch.title = title;
    if (typeof rawText === "string") patch.rawText = rawText;
    const [row] = await db.update(requirements).set(patch).where(eq(requirements.id, req.params.id)).returning();
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    res.json(row);
  });

  router.delete("/:id", async (req, res) => {
    const [row] = await db
      .update(requirements)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(requirements.id, req.params.id))
      .returning();
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    res.status(204).end();
  });

  router.post("/:id/analyze", async (req, res) => {
    const [requirement] = await db.select().from(requirements).where(eq(requirements.id, req.params.id));
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    // Fire-and-forget: analysis can take a while (real LLM call). The client
    // polls GET /:id or the agent-runs feed for progress.
    const activeAppBaseUrl = urlConfigService?.getActiveConfig().appBaseUrl;
    runIntelligenceAgent(db, config, req.params.id, activeAppBaseUrl).catch((err) => {
      console.error(`Intelligence agent failed for requirement ${req.params.id}:`, err);
    });
    res.status(202).json({ status: "analyzing" });
  });

  return router;
}
