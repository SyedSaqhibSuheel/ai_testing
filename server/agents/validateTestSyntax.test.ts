import assert from "node:assert/strict";
import { test } from "node:test";
import { checkLocatorHallucination } from "./validateTestSyntax.js";

test("checkLocatorHallucination accepts a concrete instance of a known dynamic testid pattern", () => {
  // Exactly the shape src/context/frontendScanner.ts records for a dynamic
  // testid: the raw template-literal source text, backticks included.
  const confirmedTestIds = new Set<string>(["`button-view-${customer.customerId}`"]);
  const code = `
    import { test, expect } from "@playwright/test";
    test("x", async ({ page }) => {
      await page.getByTestId("button-view-12345678").click();
    });
  `;
  const result = checkLocatorHallucination(code, confirmedTestIds);
  assert.equal(result.valid, true, result.error);
});

test("checkLocatorHallucination still rejects a testid matching no known pattern", () => {
  const confirmedTestIds = new Set<string>(["`button-view-${customer.customerId}`", "tab-database"]);
  const code = `
    import { test, expect } from "@playwright/test";
    test("x", async ({ page }) => {
      await page.getByTestId("button-totally-made-up").click();
    });
  `;
  const result = checkLocatorHallucination(code, confirmedTestIds);
  assert.equal(result.valid, false);
  assert.match(result.error ?? "", /button-totally-made-up/);
});

test("checkLocatorHallucination still accepts an exact static match", () => {
  const confirmedTestIds = new Set<string>(["tab-database"]);
  const code = `
    import { test, expect } from "@playwright/test";
    test("x", async ({ page }) => {
      await page.getByTestId("tab-database").click();
    });
  `;
  const result = checkLocatorHallucination(code, confirmedTestIds);
  assert.equal(result.valid, true, result.error);
});
