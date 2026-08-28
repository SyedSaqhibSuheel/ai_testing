# Playwright Dynamic Environment Integration

Quick guide to integrating dynamic URLs into your Playwright test agents.

---

## 🎯 Quick Integration

### 1. Update Agent to Receive URLConfigService

**Before:**
```typescript
export async function generateTests(
  db: Db,
  scenario: Scenario
) {
  const appUrl = "http://localhost:5000"; // ❌ Hardcoded
  // ...
}
```

**After:**
```typescript
import { URLConfigService } from "../config/urlConfigService.js";

export async function generateTests(
  db: Db,
  scenario: Scenario,
  urlConfigService: URLConfigService  // ✅ Injected
) {
  const config = urlConfigService.getActiveConfig();
  const appUrl = config.appBaseUrl;  // ✅ Dynamic
  // ...
}
```

---

### 2. Update Playwright Launch

**File:** `server/mcp/playwrightClient.ts`

```typescript
import { URLConfigService } from "../config/urlConfigService.js";

export class PlaywrightMcpSession {
  private urlConfigService: URLConfigService;

  constructor(
    mcp: ModelContextProtocol,
    config: Config,
    urlConfigService: URLConfigService  // ✅ Inject
  ) {
    this.mcp = mcp;
    this.config = config;
    this.urlConfigService = urlConfigService;
  }

  async launchBrowser() {
    const urlConfig = this.urlConfigService.getActiveConfig();
    const baseUrl = urlConfig.appBaseUrl;  // ✅ Use active URL

    const browser = await chromium.launch({
      headless: this.config.mcpHeadless,
    });

    const context = await browser.newContext({
      baseURL: baseUrl,  // ✅ Set base URL
    });

    const page = await context.newPage();

    // Log which environment we're testing
    console.log(`[Playwright] Launching browser against: ${baseUrl}`);

    return { browser, context, page };
  }
}
```

---

### 3. Update Test Executor

**File:** `server/mcp/testExecutor.ts` (or similar)

```typescript
import { URLConfigService } from "../config/urlConfigService.js";

export async function executeTest(
  scenario: Scenario,
  db: Db,
  urlConfigService: URLConfigService
) {
  const config = urlConfigService.getActiveConfig();

  console.log(`Running test against:
    App: ${config.appBaseUrl}
    API: ${config.apiBaseUrl}
  `);

  const browser = await launchBrowser(config.appBaseUrl);
  const page = await browser.newPage({
    baseURL: config.appBaseUrl,  // ✅ Dynamic base
  });

  try {
    // Scenario execution steps
    for (const step of scenario.steps) {
      if (step.type === "navigate") {
        // baseURL is automatically prepended
        await page.goto(step.path);  // e.g., "/login"
      } else if (step.type === "api_call") {
        // Make API calls to active API base URL
        const apiUrl = urlConfigService.resolveApiUrl(step.endpoint);
        const response = await fetch(apiUrl, {
          method: step.method,
          headers: { "Content-Type": "application/json" },
          body: step.body ? JSON.stringify(step.body) : undefined,
        });
        // ...
      }
    }
  } finally {
    await browser.close();
  }
}
```

---

### 4. Update Agent Routes

**File:** `server/routes/scenarios.ts`

```typescript
import { URLConfigService } from "../config/urlConfigService.js";

export function scenariosRouter(
  db: Db,
  config: Config,
  urlConfigService: URLConfigService  // ✅ Add parameter
) {
  const router = Router();

  // POST /scenarios/:id/regenerate
  router.post("/:id/regenerate", async (req, res) => {
    try {
      const scenario = await getScenario(db, req.params.id);
      
      // ✅ Pass URLConfigService to agent
      const regenerated = await regenerateScenario(
        db,
        scenario,
        urlConfigService
      );

      res.json(regenerated);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
}
```

---

### 5. Update Server Initialization

**File:** `server/index.ts`

```typescript
import { URLConfigService } from "./config/urlConfigService.js";
import { scenariosRouter } from "./routes/scenarios.js";

const urlConfigService = new URLConfigService(db, {
  defaultAppBaseUrl: config.appBaseUrl,
  defaultApiBaseUrl: config.apiBaseUrl,
});

// ✅ Pass to routes
app.use(
  "/api/scenarios",
  scenariosRouter(db, config, urlConfigService)
);

// ✅ Also pass to other agents
app.use(
  "/api/test-files",
  testFilesRouter(db, config, urlConfigService)
);
```

---

## 🧪 Complete Example: Scenario Execution

Here's a complete example of a test execution with dynamic URLs:

```typescript
// File: server/executor/runDynamicScenario.ts

import { URLConfigService } from "../config/urlConfigService.js";
import { Scenario } from "../schemas/testPlan.js";
import { Browser, Page } from "@playwright/test";

export interface ScenarioExecutionContext {
  browser: Browser;
  page: Page;
  appBaseUrl: string;
  apiBaseUrl: string;
  urlConfigService: URLConfigService;
}

/**
 * Execute a scenario against the active environment
 */
export async function runDynamicScenario(
  scenario: Scenario,
  urlConfigService: URLConfigService
): Promise<{ success: boolean; results: string[] }> {
  
  // ✅ Get active environment URLs
  const config = urlConfigService.getActiveConfig();
  const results: string[] = [];

  console.log(`\n[Scenario ${scenario.id}] Starting execution`);
  console.log(`  Environment: ${config.activeProfileId}`);
  console.log(`  App URL: ${config.appBaseUrl}`);
  console.log(`  API URL: ${config.apiBaseUrl}\n`);

  // ✅ Launch browser with active app URL
  const browser = await chromium.launch({
    headless: true,
  });

  const context = await browser.newContext({
    baseURL: config.appBaseUrl,  // ✅ Use active app URL
  });

  const page = await context.newPage();

  try {
    // Execute each step
    for (const step of scenario.steps) {
      results.push(`Step ${step.index}: ${step.description}`);

      switch (step.type) {
        case "navigate":
          // ✅ baseURL automatically prepended
          await page.goto(step.target);
          results.push(`  → Navigated to ${config.appBaseUrl}${step.target}`);
          break;

        case "click":
          await page.click(step.selector);
          results.push(`  → Clicked ${step.selector}`);
          break;

        case "fill":
          await page.fill(step.selector, step.value);
          results.push(`  → Filled ${step.selector} with value`);
          break;

        case "api_call":
          // ✅ Resolve API URL with active base
          const apiUrl = urlConfigService.resolveApiUrl(step.endpoint);
          const response = await fetch(apiUrl, {
            method: step.method || "GET",
            headers: { "Content-Type": "application/json" },
            body: step.body ? JSON.stringify(step.body) : undefined,
          });
          results.push(
            `  → API call: ${step.method} ${apiUrl} → ${response.status}`
          );
          break;

        case "wait":
          await page.waitForTimeout(step.ms);
          results.push(`  → Waited ${step.ms}ms`);
          break;
      }
    }

    return {
      success: true,
      results,
    };

  } catch (error) {
    return {
      success: false,
      results: [
        ...results,
        `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  } finally {
    await browser.close();
  }
}

/**
 * Run scenario with error handling and diagnostics
 */
export async function runScenarioWithDiagnostics(
  scenario: Scenario,
  urlConfigService: URLConfigService
) {
  // Test connectivity first
  const config = urlConfigService.getActiveConfig();
  
  console.log("🔍 Checking connectivity to active environment...");
  
  const appReachable = await urlConfigService.testAppConnectivity();
  const apiReachable = await urlConfigService.testApiConnectivity();

  if (!appReachable.reachable || !apiReachable.reachable) {
    throw new Error(
      `Cannot run scenario: App=${appReachable.reachable ? "✓" : "✗"}, API=${apiReachable.reachable ? "✓" : "✗"}`
    );
  }

  console.log("✓ Connectivity verified");

  // Run the scenario
  return runDynamicScenario(scenario, urlConfigService);
}
```

---

## 📊 Updated Route Example

**File:** `server/routes/scenarios.ts` (Complete)

```typescript
import { Router } from "express";
import type { Db } from "../db/client.js";
import type { Config } from "../../src/config.js";
import { URLConfigService } from "../config/urlConfigService.js";
import { runDynamicScenario } from "../executor/runDynamicScenario.js";

export function scenariosRouter(
  db: Db,
  config: Config,
  urlConfigService: URLConfigService
) {
  const router = Router();

  /**
   * GET /scenarios/:id
   * Get scenario details
   */
  router.get("/:id", (req, res) => {
    try {
      const scenario = db.query
        .selectFrom("scenarios")
        .where("id", "=", req.params.id)
        .selectAll()
        .executeTakeFirst();

      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }

      res.json(scenario);
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  /**
   * POST /scenarios/:id/execute
   * Execute scenario against active environment
   */
  router.post("/:id/execute", async (req, res) => {
    try {
      const scenario = db.query
        .selectFrom("scenarios")
        .where("id", "=", req.params.id)
        .selectAll()
        .executeTakeFirst();

      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }

      // ✅ Run against active environment
      const result = await runDynamicScenario(scenario, urlConfigService);

      res.json({
        scenarioId: scenario.id,
        success: result.success,
        results: result.results,
        executedAt: new Date().toISOString(),
        activeProfile: urlConfigService.getActiveConfig().activeProfileId,
      });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  });

  return router;
}
```

---

## 🔗 Passing URLConfigService Through Routes

**Pattern:**

```typescript
// In server/index.ts
const urlConfigService = new URLConfigService(db, {
  defaultAppBaseUrl: config.appBaseUrl,
  defaultApiBaseUrl: config.apiBaseUrl,
});

// Pass to all routers that need it
app.use("/api/scenarios", scenariosRouter(db, config, urlConfigService));
app.use("/api/test-files", testFilesRouter(db, config, urlConfigService));
app.use("/api/agent-runs", agentRunsRouter(db, config, urlConfigService));
app.use("/api", planRouter(db, config, urlConfigService));
```

**In each route file:**

```typescript
export function myRouter(
  db: Db,
  config: Config,
  urlConfigService: URLConfigService  // ← Receive it
) {
  const router = Router();

  router.post("/execute", async (req, res) => {
    const activeConfig = urlConfigService.getActiveConfig();
    // Use activeConfig.appBaseUrl, activeConfig.apiBaseUrl
  });

  return router;
}
```

---

## ✅ Checklist

- [ ] URLConfigService imported in agents
- [ ] `getActiveConfig()` called to get URLs
- [ ] Playwright baseURL set to `config.appBaseUrl`
- [ ] API calls use `resolveApiUrl()` for endpoints
- [ ] Error handling for connectivity issues
- [ ] Routes receive and pass URLConfigService
- [ ] Server initialization creates URLConfigService
- [ ] Tests run against active profile URLs
- [ ] No hardcoded localhost URLs

---

## 🚀 Result

Your Playwright agents now:
- ✅ Test against **any configured environment**
- ✅ Switch environments **without restart**
- ✅ Handle **multiple team workflows**
- ✅ Support **CI/CD integration**
- ✅ Provide **detailed diagnostics**

**No more hardcoded URLs!** 🎉
