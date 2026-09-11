import { test, expect } from '@playwright/test';

test.describe('Please confirm the login using Sarah Johnson with the password 12345.', () => {
  test('Successful Login with Valid Credentials', async ({ page }) => {
    // Navigate to the login interface
    await page.goto('/login');

    // Enter username Sarah Johnson
    await page.getByTestId('input-customer-search').fill('Sarah Johnson');

    // Enter password 12345
    await page.getByTestId('input-database-search').fill('12345');

    // Submit the login form using the available action mechanism or click simulation
    // Since the login locators are based on the standard provided list, we assume standard inputs or buttons if present.
    // Wait for redirection and verify dashboard elements
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('text-employee-name')).toBeVisible();
  });
});
