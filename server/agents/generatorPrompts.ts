import type { Scenario } from "../../src/schemas/testPlan.js";

export function buildGeneratorSystemPrompt(): string {
  return [
    "MOCK_TASK: generate",
    "You are a senior QA automation engineer writing a real, executable Playwright TypeScript test file for a banking helpdesk web app, from an already-approved, grounded test plan.",
    "",
    "Rules:",
    "- Import from '@playwright/test': `import { test, expect } from '@playwright/test';`",
    "- Wrap everything in one `test.describe(<requirement title>, () => { ... })` block.",
    "- One `test(<title>, async ({ page }) => { ... })` per scenario, in the same order given.",
    "- Use `await page.goto(<route>)` for navigation, `page.getByTestId('<exact id>')` for every element interaction/assertion - ONLY use testids from the CONFIRMED LOCATORS list given below, verbatim. Never invent a testid or use a CSS/text selector as a substitute.",
    "- Use real `expect(...)` assertions derived from each scenario's expectedUiOutcomes/passCriteria - e.g. `await expect(page.getByTestId('...')).toBeVisible()`, `.toHaveText(...)`, etc.",
    "- If login is required (credentials are given below), write a small beforeEach or inline login flow reused across tests.",
    "- The file must be valid, self-contained TypeScript with no placeholder/TODO code - every test must be a real, runnable Playwright test even if you have to make a reasonable, clearly-commented assumption for a gap in the plan.",
    "",
    "Output ONLY a single JSON object matching this shape (no markdown fences, no commentary):",
    JSON.stringify(
      {
        code: "string - the full .spec.ts file content",
        tests: [{ scenarioId: "string - exact scenario id from the input", testTitle: "string - exact string passed to test(...)" }],
      },
      null,
      2
    ),
  ].join("\n");
}

export function buildGeneratorUserPrompt(
  requirementTitle: string,
  scenarios: Scenario[],
  confirmedTestIds: string[],
  confirmedRoutes: string[],
  login?: { username: string; password: string }
): string {
  return [
    `REQUIREMENT TITLE: ${requirementTitle}`,
    "",
    "## Approved grounded scenarios (in order)",
    JSON.stringify(scenarios, null, 2),
    "",
    "## CONFIRMED LOCATORS (only use these exact strings with getByTestId)",
    confirmedTestIds.map((t) => `- ${t}`).join("\n") || "(none - be conservative)",
    "",
    "## CONFIRMED ROUTES",
    confirmedRoutes.map((r) => `- ${r}`).join("\n") || "(none - use '/' if unsure)",
    "",
    login ? `## Login\nUsername field value: "${login.username}"\nPassword field value: "${login.password}"` : "## Login\nNo login credentials configured - assume the app doesn't require auth for these flows.",
  ].join("\n");
}
