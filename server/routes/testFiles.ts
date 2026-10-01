import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { requirements, testFiles, testFileScenarios } from "../db/schema.js";
import { runGeneratorAgent } from "../agents/generatorAgent.js";
import { approveTestFile, rejectTestFile } from "../testFiles/testFileTransitions.js";
import type { URLConfigService } from "../config/urlConfigService.js";

export function testFilesRouter(db: Db, config: Config, urlConfigService?: URLConfigService): Router {
  const activeAppBaseUrl = () => urlConfigService?.getActiveConfig().appBaseUrl;
  const router = Router();

  router.get("/", async (req, res) => {
    const { requirementId } = req.query;
    const rows =
      typeof requirementId === "string"
        ? await db.select().from(testFiles).where(eq(testFiles.requirementId, requirementId)).orderBy(desc(testFiles.version))
        : await db.select().from(testFiles).orderBy(desc(testFiles.createdAt));
    res.json(rows);
  });

  router.get("/:id", async (req, res) => {
    const [file] = await db.select().from(testFiles).where(eq(testFiles.id, req.params.id));
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    const mapping = await db.select().from(testFileScenarios).where(eq(testFileScenarios.testFileId, file.id));
    res.json({ file, mapping });
  });

  router.get("/:id/versions", async (req, res) => {
    const [file] = await db.select().from(testFiles).where(eq(testFiles.id, req.params.id));
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    const versions = await db
      .select()
      .from(testFiles)
      .where(eq(testFiles.requirementId, file.requirementId))
      .orderBy(desc(testFiles.version));
    res.json(versions);
  });

  router.post("/:id/approve", async (req, res) => {
    try {
      const actor = typeof req.body?.actor === "string" ? req.body.actor : "unknown";
      await approveTestFile(db, req.params.id, actor);
      const [row] = await db.select().from(testFiles).where(eq(testFiles.id, req.params.id));
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/:id/reject", async (req, res) => {
    const { reason, actor } = req.body ?? {};
    if (typeof reason !== "string" || !reason.trim()) {
      res.status(400).json({ error: "reason is required to reject a test file" });
      return;
    }
    try {
      await rejectTestFile(db, req.params.id, typeof actor === "string" ? actor : "unknown", reason);
      const [row] = await db.select().from(testFiles).where(eq(testFiles.id, req.params.id));
      res.json(row);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post("/:id/regenerate", async (req, res) => {
    const [file] = await db.select().from(testFiles).where(eq(testFiles.id, req.params.id));
    if (!file) {
      res.status(404).json({ error: "Test file not found" });
      return;
    }
    try {
      const newId = await runGeneratorAgent(db, config, file.requirementId, activeAppBaseUrl());
      const [row] = await db.select().from(testFiles).where(eq(testFiles.id, newId));
      res.json(row);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

export function generateRouter(db: Db, config: Config, urlConfigService?: URLConfigService): Router {
  const router = Router();

  router.post("/requirements/:id/generate", async (req, res) => {
    const [requirement] = await db.select().from(requirements).where(eq(requirements.id, req.params.id));
    if (!requirement) {
      res.status(404).json({ error: "Requirement not found" });
      return;
    }
    runGeneratorAgent(db, config, req.params.id, urlConfigService?.getActiveConfig().appBaseUrl).catch((err) => {
      console.error(`Generator agent failed for requirement ${req.params.id}:`, err);
    });
    res.status(202).json({ status: "generating_tests" });
  });

  return router;
}
