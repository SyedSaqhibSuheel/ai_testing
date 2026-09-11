import { test, expect } from '@playwright/test';

test.describe('Please confirm that you can log in using Sarah Johnson and the password 1234', () => {
  test('Successful login with valid credentials', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');

    // Enter username using exact login locator
    await page.getByLabel('Agent Name').fill('Sarah Johnson');

    // Enter password using exact login locator (using 1234 as per test specification)
    await page.getByLabel('Password').fill('1234');

    // Submit the login form using exact login locator
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify successful redirection to the helpdesk dashboard at route /
    await expect(page).toHaveURL('/');
    
    // Verify dashboard element is visible to ensure successful authentication
    await expect(page.getByTestId('text-active-requests-title')).toBeVisible();
  });
});