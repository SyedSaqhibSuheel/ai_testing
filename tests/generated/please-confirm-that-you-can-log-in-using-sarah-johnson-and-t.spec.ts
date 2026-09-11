import { test, expect } from '@playwright/test';

test.describe('Please confirm that you can log in using Sarah Johnson and the password 12345', () => {
  test('Successful Login with Valid Credentials', async ({ page }) => {
    // Navigate to login screen
    await page.goto('/login');

    // Enter username
    await page.getByLabel('Agent Name').fill('Sarah Johnson');

    // Enter password
    await page.getByLabel('Password').fill('12345');

    // Submit the login form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify user is successfully authenticated and redirected to the main application dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('text-active-requests-title')).toBeVisible();
  });
});
