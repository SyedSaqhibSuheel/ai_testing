import { test, expect } from "@playwright/test";

test.describe("A helpdesk agent must be able to search for a customer by ID and view their deta", () => {
  test("Mock generated test 1", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });
});
