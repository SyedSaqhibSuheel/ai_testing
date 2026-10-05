import type { Scenario } from "../../src/schemas/testPlan.js";

export function buildGeneratorSystemPrompt(): string {
  return [
    "MOCK_TASK: generate",
    "You are a senior QA automation engineer writing a real, executable Playwright TypeScript test file for a web app, from an already-approved, grounded test plan.",
    "",
    "Rules:",
    "- Import from '@playwright/test': `import { test, expect } from '@playwright/test';`",
    "- Wrap everything in one `test.describe(<requirement title>, () => { ... })` block.",
    "- One `test(<title>, async ({ page }) => { ... })` per scenario, in the same order given.",
    "- If a scenario's `groundable` field is `false`, do NOT write its steps - live exploration already determined there is no real UI path to its precondition (it's usually a state only a backend/websocket event can cause, not a click). Instead write exactly: `test(<title>, async ({ page }) => { test.skip(true, '<ungroundableReason, verbatim>'); });` so it reports as skipped, not a false failure.",
    "- IMPORTANT: Use the FULL URL (with base URL) for page.goto(). If a base URL is provided, combine it with routes. Example: `await page.goto('https://example.com/login')`",
    "- Use `page.getByTestId('<exact id>')` for every element interaction/assertion where a matching entry exists in the CONFIRMED LOCATORS list given below - use it verbatim. Never invent a testid that isn't in that list.",
    "- A CONFIRMED LOCATORS entry ending in `*` (e.g. `button-request-*`) means the source renders one such element per list item with a dynamic id suffix (e.g. the real DOM database id) that cannot be known in advance. For these, do NOT invent a plausible-looking suffix (no `-123`, `-abc`, etc. - that id will not exist and the test will fail). Instead strip the trailing `*` and use an attribute-prefix locator, e.g. `page.locator('[data-testid^=\"button-request-\"]').first()`, optionally `.nth(n)` or filtered by visible text for a specific item.",
    "- Dropdowns in this app are custom comboboxes (a <button role=\"combobox\">, e.g. Radix/shadcn Select - any `select-*` testid), NOT native <select> elements. NEVER use `.selectOption()` or `toHaveValue()` on them - both fail. Instead click the trigger, click the option by its visible label, then assert the trigger's text, e.g. `await page.getByTestId('select-status-filter').click(); await page.getByRole('option', { name: 'Active', exact: true }).click(); await expect(page.getByTestId('select-status-filter')).toContainText('Active');`",
    "- Toast notifications render their text twice (the visible toast plus a hidden screen-reader copy), so a text match on toast content hits 2 elements and fails Playwright's strict mode - always add `.first()`, e.g. `await expect(page.getByText('...').first()).toBeVisible()`.",
    "- If a scenario needs to interact with an element that has no matching entry in CONFIRMED LOCATORS at all (e.g. a plain button/link mentioned only by its visible label in the scenario or requirement text, not in the testid list), do NOT invent a testid for it either. Use `page.getByRole(...)` or `page.getByText(...)` with the element's real visible text instead - this is the one case where a non-testid locator is correct, precisely because guessing a testid would silently fail instead of failing loudly.",
    "- Use real `expect(...)` assertions derived from each scenario's expectedUiOutcomes/passCriteria - e.g. `await expect(page.getByTestId('...')).toBeVisible()`, `.toHaveText(...)`, etc.",
    "- Each CONFIRMED LOCATOR is annotated with the screen/component that renders it. An element in a details panel, modal, dialog or tab only exists after the action that opens it - e.g. to assert a details-panel field for a searched item, first click that item in the results list (its own list-item locator), then assert the field. Never assert a details/modal locator straight after typing a search.",
    "- Playwright locators are strict: a text/role locator that matches more than one element fails the test. When you must assert visible text (e.g. a toast or error message that has no testid), use `getByText('<text>', { exact: true })` - toasts are often rendered twice (visible title + a screen-reader announcement), so a non-exact match will hit both.",
    "- Never write a test whose pass depends on WAITING for a real person or external system to actually respond (e.g. really waiting for a customer to approve/deny a push notification on their phone, or a real email/SMS/OTP to arrive) - such a result can never appear in an automated run.",
    "- BUT if a step's `notes` names specific request(s) (method + url) that must be intercepted because the real response comes from outside the browser, DO write the full scenario through to its assertion, using `page.route(<url glob>, (route) => route.fulfill({ json: <synthetic body> }))` registered BEFORE the action that triggers that request, for each named request. Make up a plausible JSON body for each (e.g. `{ sessionId: 'e2e-mock-session' }` for a request that just needs to succeed and return an id used later; a value that plausibly means success/failure for a request the UI polls to learn the outcome - match the notes' stated expectation, positive scenarios get a success-shaped response, negative ones get a failure-shaped one). Comment the mock with why: `// Simulates <what completes this externally> - <method> <url> happens outside this app` - this is simulating a documented external contract, not hallucinating one, so it IS correct to write the real steps including this interception, unlike the rule above.",
    "- If login is required (credentials are given below), write a small beforeEach or inline login flow reused across tests. If LOGIN LOCATORS are given below, they are the ONLY correct way to interact with the login form (it has no data-testids) - copy those exact Playwright expressions verbatim for the username field, password field, and submit action, in that order. Do not use getByTestId for the login form in that case, and do not invent alternative locators for it.",
    "- The Login section below is the single source of truth for credentials: always type exactly its username and password, even if a scenario step's inputValue shows different credentials. Never make up credentials (e.g. 'testagent', 'password123', 'admin') - if no login is configured and a flow needs one, say so in a comment instead of guessing.",
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
  login?: { username: string; password: string; usernameLocator?: string; passwordLocator?: string; submitLocator?: string },
  appBaseUrl?: string,
  testIdComponents?: Map<string, Set<string>>
): string {
  const locatorLine = (t: string) => {
    const components = testIdComponents?.get(t);
    return `- ${t}${components?.size ? ` (rendered by ${[...components].join(", ")})` : ""}`;
  };
  const loginSection = !login
    ? "## Login\nNo login credentials configured - assume the app doesn't require auth for these flows."
    : [
        "## Login",
        `Username field value: "${login.username}"`,
        `Password field value: "${login.password}"`,
        "These are the ONLY working credentials. Any login that is expected to SUCCEED (including the login step of every scenario that needs an authenticated user) must use exactly these values, even if a scenario plan shows different ones. Only scenarios that deliberately test a FAILED login may use other values.",
        login.usernameLocator && login.passwordLocator && login.submitLocator
          ? [
              "## LOGIN LOCATORS (verbatim - the login form has no data-testids, do not use getByTestId for it)",
              `Username field: ${login.usernameLocator}`,
              `Password field: ${login.passwordLocator}`,
              `Submit action: ${login.submitLocator}`,
              "After the submit action of a login expected to SUCCEED, the app stores the session asynchronously, so ALWAYS wait for the redirect first - e.g. `await page.waitForURL(<base URL>/)` - before any page.goto() or further interaction. Calling page.goto() straight after the click races the login and lands back on the login page.",
            ].join("\n")
          : null,
      ]
        .filter(Boolean)
        .join("\n");

  return [
    `REQUIREMENT TITLE: ${requirementTitle}`,
    "",
    "## Approved grounded scenarios (in order)",
    JSON.stringify(scenarios, null, 2),
    "",
    "## CONFIRMED LOCATORS (use these exact strings with getByTestId; entries ending in `*` are dynamic-prefix patterns - see rules above)",
    confirmedTestIds.map(locatorLine).join("\n") || "(none - be conservative)",
    "",
    "## CONFIRMED ROUTES",
    confirmedRoutes.map((r) => `- ${r}`).join("\n") || "(none - use '/' if unsure)",
    "",
    appBaseUrl ? `## Application Base URL\nAll navigation should use this base URL: ${appBaseUrl}\nExample: await page.goto('${appBaseUrl}/login');` : "## Application Base URL\nNo base URL configured - use relative routes.",
    "",
    loginSection,
  ].join("\n");
}
