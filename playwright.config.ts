import { defineConfig, devices } from "@playwright/test";

// This file is committed as-is by the AI Testing Platform's Generator agent.
// Execution (Phase 2 / CI-CD) reads baseURL from PLAYWRIGHT_BASE_URL so the
// same generated tests can target local dev, staging, etc. without editing
// generated code.
// The AI Testing Platform runs `npx playwright test --output=test-results/<runId>`
// per execution (see ai-test-framework/server/execution/runTests.ts) so each
// run's artifacts land in their own directory - execution history stays
// intact instead of each run overwriting the last one's screenshots/traces.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  // JSON reporter's output path is controlled per-run via the
  // PLAYWRIGHT_JSON_OUTPUT_NAME env var (set by runTests.ts), so each
  // execution's structured report lands in its own run directory.
  reporter: [["html", { open: "never", outputFolder: "playwright-report" }], ["json"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
