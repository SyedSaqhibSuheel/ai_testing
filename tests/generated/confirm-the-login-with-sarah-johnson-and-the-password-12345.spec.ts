import { test, expect } from '@playwright/test';

test.describe('Confirm the login with Sarah Johnson and the password 12345', () => {
  test('Successful Login with Valid Credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('input-agent-name').fill('Sarah Johnson');
    await page.getByTestId('input-password').fill('12345');
    await page.getByTestId('button-sign-in').click();
    await expect(page).toHaveURL('/');
  });

  test('Successful Login with Specific Credentials for Sarah Johnson', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('input-agent-name').fill('Sarah Johnson');
    await page.getByTestId('input-password').fill('12345');
    await page.getByTestId('button-sign-in').click();
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('text-active-requests-title')).toBeVisible();
    await expect(page.getByTestId('text-employee-name')).toBeVisible();
  });
});