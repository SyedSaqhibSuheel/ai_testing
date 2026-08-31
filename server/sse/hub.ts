import type { Request, Response } from "express";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { agentRuns } from "../db/schema.js";
import { onAgentRunChange } from "../agents/agentRunTracking.js";

/**
 * Minimal SSE hub: every agent_runs write (see agentRunTracking.ts) pushes
 * the changed run's id here, we look it up and broadcast it to every
 * connected client. One-directional server->client status push - no
 * client->server realtime need, so SSE over plain HTTP rather than
 * WebSocket (simpler through a dev proxy, EventSource auto-reconnects,
 * zero new dependencies for Express).
 */
export function attachSseHub(db: Db, app: { get: (path: string, handler: (req: Request, res: Response) => void) => void }): void {
  const clients = new Set<Response>();

  onAgentRunChange((runId) => {
    const run = db.select().from(agentRuns).where(eq(agentRuns.id, runId)).get();
    if (!run) return;
    const payload = `data: ${JSON.stringify(run)}\n\n`;
    for (const res of clients) res.write(payload);
  });

  app.get("/api/agent-runs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.writeHead(200);
    res.write(": connected\n\n");
    clients.add(res);

    req.on("close", () => {
      clients.delete(res);
    });
  });
}
