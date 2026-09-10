import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Config } from "../config.js";
import { listRuns, loadRunDetail, newRunId } from "../store/runStore.js";
import { planAndRunOnce } from "../orchestrate.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface JobState {
  runId: string;
  requirement: string;
  appBaseUrl: string;
  status: "running" | "done" | "error";
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

export function startDashboard(config: Config): void {
  const app = express();
  app.use(express.json());

  // Single-run-at-a-time: this is a local single-user tool and free-tier LLM
  // quotas are scarce, so there's no value in letting concurrent runs
  // contend for the same rate limit.
  const jobs = new Map<string, JobState>();
  let activeRunId: string | null = null;

  app.get("/api/runs", (_req, res) => {
    res.json(listRuns(config.runsDir));
  });

  app.get("/api/runs/:id", (req, res) => {
    try {
      res.json(loadRunDetail(config.runsDir, req.params.id));
    } catch {
      res.status(404).json({ error: "Run not found" });
    }
  });

  app.get("/api/config", (_req, res) => {
    res.json({ appBaseUrl: config.appBaseUrl, llmProvider: config.llmProvider });
  });

  app.get("/api/jobs/active", (_req, res) => {
    res.json(activeRunId ? jobs.get(activeRunId) ?? null : null);
  });

  app.get("/api/jobs/:runId", (req, res) => {
    const job = jobs.get(req.params.runId);
    if (!job) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json(job);
  });

  app.post("/api/generate", (req, res) => {
    const requirement = typeof req.body?.requirement === "string" ? req.body.requirement.trim() : "";
    const appBaseUrl = typeof req.body?.appBaseUrl === "string" && req.body.appBaseUrl.trim() ? req.body.appBaseUrl.trim() : undefined;

    if (!requirement) {
      res.status(400).json({ error: "requirement is required" });
      return;
    }
    if (activeRunId && jobs.get(activeRunId)?.status === "running") {
      res.status(409).json({ error: "A run is already in progress", runId: activeRunId });
      return;
    }

    const runId = newRunId();
    const job: JobState = {
      runId,
      requirement,
      appBaseUrl: appBaseUrl ?? config.appBaseUrl,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    jobs.set(runId, job);
    activeRunId = runId;

    // Fire-and-forget: the HTTP response returns immediately with the runId;
    // the client polls /api/jobs/:runId for status. A plan+run against a
    // real browser and LLM can take minutes, far past any reasonable HTTP
    // request timeout.
    planAndRunOnce(config, requirement, appBaseUrl, runId)
      .then(() => {
        jobs.set(runId, { ...job, status: "done", finishedAt: new Date().toISOString() });
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        jobs.set(runId, { ...job, status: "error", error: message, finishedAt: new Date().toISOString() });
      })
      .finally(() => {
        if (activeRunId === runId) activeRunId = null;
      });

    res.status(202).json({ runId });
  });

  app.use("/runs", express.static(config.runsDir));
  app.use("/", express.static(path.join(__dirname, "public")));

  app.listen(config.dashboardPort, () => {
    console.log(`Dashboard running at http://localhost:${config.dashboardPort}`);
  });
}
