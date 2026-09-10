import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, testFiles, testFileScenarios } from "../db/schema.js";
import { runGeneratorAgent } from "../agents/generatorAgent.js";
import { approveTestFile, rejectTestFile } from "../testFiles/testFileTransitions.js";

export function testFilesRouter(db: Db, config: Config): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const { requirementId } = req.query;
    const rows =
      typeof requirementId === "string"
        ? db.select().from(testFiles).where(eq(testFiles.requirementId, requirementId)).orderBy(desc(testFiles.version)).all()
        : db.select().from(testFiles).orderBy(desc(testFiles.createdAt)).all();
    res.json(rows);
  });

  router.get("/:id", (req, res) => {
    const file = db.select().from(testFiles).where(eq(testFiles.id, req.params.id)).get();
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    const mapping = db.select().from(testFileScenarios).where(eq(testFileScenarios.testFileId, file.id)).all();
    res.json({ file, mapping });
  });

  router.get("/:id/versions", (req, res) => {
    const file = db.select().from(testFiles).where(eq(testFiles.id, req.params.id)).get();
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    const versions = db
      .select()
      .from(testFiles)
      .where(eq(testFiles.requirementId, file.requirementId))
      .orderBy(desc(testFiles.version))
      .all();
    res.json(versions);
  });

  router.post("/:id/approve", (req, res) => {
    try {
      const actor = typeof req.body?.actor === "string" ? req.body.actor : "unknown";
      approveTestFile(db, req.params.id, actor);
      res.json(db.select().from(testFiles).where(eq(testFiles.id, req.params.id)).get());
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/:id/reject", (req, res) => {
    const { reason, actor } = req.body ?? {};
    if (typeof reason !== "string" || !reason.trim()) {
      res.status(400).json({ error: "reason is required to reject a test file" });
      return;
    }
    try {
      rejectTestFile(db, req.params.id, typeof actor === "string" ? actor : "unknown", reason);
      res.json(db.select().from(testFiles).where(eq(testFiles.id, req.params.id)).get());
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/:id/regenerate", async (req, res) => {
    const file = db.select().from(testFiles).where(eq(testFiles.id, req.params.id)).get();
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    try {
      const newId = await runGeneratorAgent(db, config, file.requirementId);
      res.json(db.select().from(testFiles).where(eq(testFiles.id, newId)).get());
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

export function generateRouter(db: Db, config: Config): Router {
  const router = Router();

  router.post("/requirements/:id/generate", (req, res) => {
    const requirement = db.select().from(requirements).where(eq(requirements.id, req.params.id)).get();
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    runGeneratorAgent(db, config, req.params.id).catch((err) => {
      console.error(`Generator agent failed for requirement ${req.params.id}:`, err);
    });
    res.status(202).json({ status: "generating_tests" });
  });

  return router;
}
