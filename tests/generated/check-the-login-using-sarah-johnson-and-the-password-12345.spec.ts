import { test, expect } from '@playwright/test';

test.describe('Check the login using Sarah Johnson and the password 12345.', () => {
  test('Successful Login with Valid Credentials', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Agent Name').fill('Sarah Johnson');
    await page.getByLabel('Password').fill('12345');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('text-active-requests-title')).toBeVisible();
    await expect(page.getByTestId('button-logout')).toBeVisible();
  });
});
