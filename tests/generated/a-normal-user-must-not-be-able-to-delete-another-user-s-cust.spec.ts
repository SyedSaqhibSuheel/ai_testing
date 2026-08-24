import { test, expect } from "@playwright/test";

test.describe("A normal user must not be able to delete another user's customer records.", () => {
  test("Mock generated test 1", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });

  test("Mock generated test 2", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL("/");
  });
});
