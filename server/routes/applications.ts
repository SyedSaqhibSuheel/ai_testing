import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { applications } from "../db/schema.js";

export function applicationsRouter(db: Db): Router {
  const router = Router();

  // Get all applications
  router.get("/", (req, res) => {
    const rows = db
      .select()
      .from(applications)
      .orderBy(desc(applications.createdAt))
      .all();

    res.json(rows);
  });

  // Create a new application
  router.post("/", (req, res) => {
    const { name, description } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    try {
      const row = db
        .insert(applications)
        .values({
          name: name.trim(),
          description:
            typeof description === "string" && description.trim()
              ? description.trim()
              : null,
        })
        .returning()
        .get();

      res.status(201).json(row);
    } catch (err) {
      res.status(409).json({
        error:
          err instanceof Error
            ? err.message
            : "Application already exists",
      });
    }
  });

  // Get one application
  router.get("/:id", (req, res) => {
    const application = db
      .select()
      .from(applications)
      .where(eq(applications.id, req.params.id))
      .get();

    if (!application) {
      res.status(404).json({ error: "Application not found" });
      return;
    }

    res.json(application);
  });

  return router;
}