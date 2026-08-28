import express from "express";
import { loadConfig } from "../src/config.js";
import { createDb } from "./db/client.js";
import { requirementsRouter } from "./routes/requirements.js";
import { scenariosRouter } from "./routes/scenarios.js";
import { settingsRouter } from "./routes/settings.js";
import { agentRunsRouter } from "./routes/agentRuns.js";
import { planRouter } from "./routes/plan.js";
import { testFilesRouter, generateRouter } from "./routes/testFiles.js";
import { gitRouter } from "./routes/git.js";
import { dashboardRouter } from "./routes/dashboard.js";
import { createUrlConfigRouter } from "./routes/urlConfig.js";
import { URLConfigService } from "./config/urlConfigService.js";
import { attachSseHub } from "./sse/hub.js";

const config = loadConfig();
const db = createDb(config.dbPath);
const urlConfigService = new URLConfigService(db, {
  defaultAppBaseUrl: config.appBaseUrl,
  defaultApiBaseUrl: config.apiBaseUrl,
});

const app = express();
app.use(express.json());

// Registered before agentRunsRouter's `GET /:id` so the literal `/stream`
// path isn't swallowed as an :id param.
attachSseHub(db, app);

app.use("/api/requirements", requirementsRouter(db, config));
app.use("/api/scenarios", scenariosRouter(db, config, urlConfigService));
app.use("/api/settings", settingsRouter(db, config));
app.use("/api/agent-runs", agentRunsRouter(db));
app.use("/api", planRouter(db, config));
app.use("/api/test-files", testFilesRouter(db, config));
app.use("/api", generateRouter(db, config));
app.use("/api/git", gitRouter(db, config));
app.use("/api/dashboard", dashboardRouter(db));
app.use("/api/url-config", createUrlConfigRouter(db, config));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, llmProvider: config.llmProvider });
});

app.listen(config.serverPort, () => {
  console.log(`AI Testing Platform API listening on http://localhost:${config.serverPort}`);
});
