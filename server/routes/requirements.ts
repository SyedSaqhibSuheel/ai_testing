import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, requirementAnalyses, scenarios } from "../db/schema.js";
import { runIntelligenceAgent } from "../agents/intelligenceAgent.js";

export function requirementsRouter(db: Db, config: Config): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const rows = db.select().from(requirements).where(eq(requirements.isDeleted, false)).orderBy(desc(requirements.createdAt)).all();
    res.json(rows);
  });

  router.post("/", (req, res) => {
    const { title, rawText, submittedBy } = req.body ?? {};
    if (typeof rawText !== "string" || !rawText.trim()) {
      res.status(400).json({ error: "rawText is required" });
      return;
    }
    const row = db
      .insert(requirements)
      .values({
        title: typeof title === "string" && title.trim() ? title.trim() : rawText.slice(0, 80),
        rawText: rawText.trim(),
        submittedBy: typeof submittedBy === "string" && submittedBy.trim() ? submittedBy.trim() : "unknown",
      })
      .returning()
      .get();
    res.status(201).json(row);
  });

  router.get("/:id", (req, res) => {
    const requirement = db.select().from(requirements).where(eq(requirements.id, req.params.id)).get();
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    const analysis = requirement.currentAnalysisId
      ? db.select().from(requirementAnalyses).where(eq(requirementAnalyses.id, requirement.currentAnalysisId)).get()
      : null;
    const scenarioRows = db
      .select()
      .from(scenarios)
      .where(and(eq(scenarios.requirementId, requirement.id), eq(scenarios.isDeleted, false)))
      .orderBy(desc(scenarios.createdAt))
      .all();
    res.json({ requirement, analysis, scenarios: scenarioRows });
  });

  router.patch("/:id", (req, res) => {
    const { title, rawText } = req.body ?? {};
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof title === "string") patch.title = title;
    if (typeof rawText === "string") patch.rawText = rawText;
    const row = db.update(requirements).set(patch).where(eq(requirements.id, req.params.id)).returning().get();
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    res.json(row);
  });

  router.delete("/:id", (req, res) => {
    const row = db
      .update(requirements)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(requirements.id, req.params.id))
      .returning()
      .get();
    if (!row) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    res.status(204).end();
  });

  router.post("/:id/analyze", (req, res) => {
    const requirement = db.select().from(requirements).where(eq(requirements.id, req.params.id)).get();
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    // Fire-and-forget: analysis can take a while (real LLM call). The client
    // polls GET /:id or the agent-runs feed for progress.
    runIntelligenceAgent(db, config, req.params.id).catch((err) => {
      console.error(`Intelligence agent failed for requirement ${req.params.id}:`, err);
    });
    res.status(202).json({ status: "analyzing" });
  });

  return router;
}
