import { test, expect } from '@playwright/test';
test('renders zero, missing, decimals, units and updates live precision', async ({ page }) => {
  page.on('pageerror', (error) => console.log(error.message));
  await page.goto('/');
  const rows = page.getByRole('grid');
  await expect(rows).toContainText('0.00 kg');
  await expect(rows).toContainText('—');
  await expect(rows).toContainText('12.35 kg');
  await page.getByRole('button', { name: 'Change precision' }).click();
  await expect(rows).toContainText('12.345 kg');
});
