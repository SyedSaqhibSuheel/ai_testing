import { Router } from "express";
import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { agentRuns } from "../db/schema.js";

export function agentRunsRouter(db: Db): Router {
  const router = Router();

  router.get("/", async (req, res) => {
    const { agentType, requirementId, status } = req.query;
    const conditions = [];
    if (typeof agentType === "string") conditions.push(eq(agentRuns.agentType, agentType as never));
    if (typeof requirementId === "string") conditions.push(eq(agentRuns.requirementId, requirementId));
    if (typeof status === "string") conditions.push(eq(agentRuns.status, status as never));
    const rows = await db
      .select()
      .from(agentRuns)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(agentRuns.startedAt))
      .limit(200);
    res.json(rows);
  });

  router.get("/:id", async (req, res) => {
    const [row] = await db.select().from(agentRuns).where(eq(agentRuns.id, req.params.id));
    if (!row) {
      res.status(404).json({ error: "Agent run not found" });
      return;
    }
    res.json(row);
  });

  return router;
}
