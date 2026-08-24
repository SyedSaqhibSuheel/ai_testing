import { defineConfig, devices } from "@playwright/test";

// This file is committed as-is by the AI Testing Platform's Generator agent.
// Execution (Phase 2 / CI-CD) reads baseURL from PLAYWRIGHT_BASE_URL so the
// same generated tests can target local dev, staging, etc. without editing
// generated code.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
