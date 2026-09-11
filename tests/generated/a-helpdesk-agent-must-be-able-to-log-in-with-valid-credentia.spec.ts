import { test, expect } from '@playwright/test';

test.describe('A helpdesk agent must be able to log in with valid credentials', () => {
  test('Helpdesk Agent Successful Login', async ({ page }) => {
    // Navigate to the login interface
    await page.goto('/login');

    // Enter valid username Sarah Johnson
    await page.getByLabel('Agent Name').fill('Sarah Johnson');

    // Enter valid password 12345
    await page.getByLabel('Password').fill('12345');

    // Submit the login form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify user is redirected to the dashboard route /
    await expect(page).toHaveURL('/');

    // Verify Active Requests dashboard title is visible
    await expect(page.getByTestId('text-active-requests-title')).toBeVisible();

    // Verify Employee name displays Sarah Johnson
    await expect(page.getByTestId('text-employee-name')).toHaveText('Sarah Johnson');
  });
});