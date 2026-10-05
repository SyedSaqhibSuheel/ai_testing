import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { applications } from "../db/schema.js";
import { getActiveApplication, setActiveApplication, hasSourceAccess, resolveAppConfig } from "../config/activeApplication.js";

type ApplicationRow = typeof applications.$inferSelect;

/** Never send the raw login password to the browser - presence only, like every other secret in this platform (see server/settings/settingsService.ts). */
function maskApplication(row: ApplicationRow) {
  const { loginPassword, ...rest } = row;
  return { ...rest, loginPasswordPresent: !!loginPassword };
}

const WRITABLE_FIELDS = [
  "name",
  "description",
  "appBaseUrl",
  "apiBaseUrl",
  "backendSrcDir",
  "frontendSrcDir",
  "frontendServerSrcDir",
  "loginUsername",
  "loginPassword",
  "loginUsernameLocator",
  "loginPasswordLocator",
  "loginSubmitLocator",
] as const;

function pickWritableFields(body: unknown): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  if (!body || typeof body !== "object") return patch;
  for (const field of WRITABLE_FIELDS) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "string") patch[field] = value.trim() || null;
  }
  return patch;
}

export function applicationsRouter(db: Db, config: Config): Router {
  const router = Router();

  // Registered before GET /:id so "active" isn't swallowed as an :id param.
  router.get("/active", (_req, res) => {
    const active = getActiveApplication(db);
    const resolved = resolveAppConfig(db, config);
    res.json({
      application: active ? maskApplication(active) : null,
      hasSourceAccess: hasSourceAccess(resolved),
    });
  });

  router.get("/", (req, res) => {
    const rows = db.select().from(applications).orderBy(desc(applications.createdAt)).all();
    res.json(rows.map(maskApplication));
  });

  router.post("/", (req, res) => {
    const { name } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    try {
      const row = db
        .insert(applications)
        .values({ name: name.trim(), ...pickWritableFields(req.body) })
        .returning()
        .get();

      res.status(201).json(maskApplication(row));
    } catch (err) {
      res.status(409).json({
        error: err instanceof Error ? err.message : "Application already exists",
      });
    }
  });

  router.get("/:id", (req, res) => {
    const application = db.select().from(applications).where(eq(applications.id, req.params.id)).get();
    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }
    res.json(maskApplication(application));
  });

  router.patch("/:id", (req, res) => {
    const patch = pickWritableFields(req.body);
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }
    try {
      const row = db
        .update(applications)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(applications.id, req.params.id))
        .returning()
        .get();
      if (!row) {
        res.status(404).json({ error: "Application not found" });
        return;
      }
      res.json(maskApplication(row));
    } catch (err) {
      res.status(409).json({ error: err instanceof Error ? err.message : "Could not update application" });
    }
  });

  router.post("/:id/activate", (req, res) => {
    try {
      const row = setActiveApplication(db, req.params.id);
      res.json(maskApplication(row));
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : "Application not found" });
    }
  });

  return router;
}
