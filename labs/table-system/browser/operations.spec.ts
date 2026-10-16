import { test, expect } from '@playwright/test';
test('duplicate target controls share pending and survive actual virtualization', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Slow saves', exact: true }).click();
  const switches = page.getByRole('switch', { name: 'Review item-0', exact: true });
  await switches.first().click();
  await expect(switches.first()).toBeDisabled();
  await expect(switches.last()).toBeDisabled();
  await expect(page.locator('output')).toContainText('Requests: 1');
  // AG Grid v36 uses a scrollable grid body.
  const scroller = page.locator('.ag-grid-viewport');
  await page.getByRole('gridcell', { name: /^Item 10\./ }).click();
  await scroller.evaluate((element) => {
    element.scrollTop = 20000;
  });
  await expect(switches).toHaveCount(0);
  await scroller.evaluate((element) => {
    element.scrollTop = 0;
  });
  await expect(switches.first()).toBeDisabled();
  await expect(switches.first()).toHaveAttribute('aria-checked', 'false');
  await expect(switches.first()).toHaveAttribute('aria-checked', 'true');
  await expect(page.locator('output')).toContainText('Requests: 1');
});
test('failure keeps committed value and reset invalidates pending', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fail next save' }).click();
  const review = page.getByRole('switch', { name: 'Review item-0', exact: true }).first();
  await review.click();
  await expect(page.getByRole('alert').first()).toContainText('Simulated server');
  await expect(review).toHaveAttribute('aria-checked', 'false');
  await review.click();
  await page.getByRole('button', { name: 'Reset dataset' }).click();
  await page.waitForTimeout(700);
  await expect(review).toHaveAttribute('aria-checked', 'false');
});
