import { test, expect } from '@playwright/test';

test.describe('Confirm the login with Sarah Johnson and the password 12345', () => {
  test('Successful Login with Valid Credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.getByTestId('input-customer-search').fill('Sarah Johnson');
    await page.getByTestId('input-customer-search').press('Enter');
    
    await page.getByTestId('button-send-auth').click();
    
    await expect(page).toHaveURL('/');
    await expect(page.getByTestId('text-active-requests-title')).toBeVisible();
  });
});