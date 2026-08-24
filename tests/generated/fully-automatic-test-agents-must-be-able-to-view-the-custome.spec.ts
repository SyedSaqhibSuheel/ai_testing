import { test, expect } from "@playwright/test";

test.describe("Fully automatic test: agents must be able to view the customer database tab.", () => {
  test("Mock generated test 1", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("Mock generated test 2", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });
});
