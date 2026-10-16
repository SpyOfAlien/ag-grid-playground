import { test, expect } from '@playwright/test';
test('numeric validation, failure draft preservation, dismissal and retry', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fail next save' }).click();
  await page.getByRole('button', { name: 'Edit amount item-0', exact: true }).click();
  const amount = page.getByRole('spinbutton', { name: 'Amount in kg' });
  await amount.fill('-1');
  await page.getByRole('button', { name: 'Save amount' }).click();
  await expect(amount).toBeFocused();
  await expect(page.locator('output')).toContainText('Requests: 0');
  await amount.fill('8.1234');
  await page.getByRole('button', { name: 'Save amount' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Simulated server' }).first(),
  ).toContainText('Simulated server');
  await expect(amount).toHaveValue('8.1234');
  await page.getByRole('button', { name: 'Save amount' }).click();
  await expect(
    page.getByRole('button', { name: 'Edit amount item-0', exact: true }),
  ).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(amount).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit amount item-0', exact: true })).toContainText(
    '8.12 kg',
  );
  await expect(
    page
      .getByRole('button', { name: 'Edit amount item-0', exact: true })
      .locator('xpath=ancestor::*[@role="gridcell"]'),
  ).toBeFocused();
});
test('anchor removal disposes draft and newer sessions survive older saves', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Edit amount item-0', exact: true });
  await trigger.click();
  await trigger.evaluate((element) => element.remove());
  await expect(page.getByRole('spinbutton', { name: 'Amount in kg' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Edit amount item-1', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Amount in kg' }).fill('10');
  await page.getByRole('button', { name: 'Save amount' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Edit amount item-2', exact: true }).click();
  await page.waitForTimeout(700);
  await expect(page.getByRole('spinbutton', { name: 'Amount in kg' })).toHaveValue('12.345');
  await page.keyboard.press('Escape');
  await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);
});
test('revision conflict preserves an open draft without silent retry after an external update', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Edit amount item-0', exact: true }).click();
  const draft = page.getByRole('spinbutton', { name: 'Amount in kg' });
  await draft.fill('9');
  // Simulate an external feature update while the dialog owns pointer focus.
  await page
    .getByRole('button', { name: 'Change metadata', exact: true })
    .evaluate((element) => (element as HTMLButtonElement).click());
  await expect(draft).toHaveValue('9');
  await page.getByRole('button', { name: 'Save amount' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Revision conflict' }).first(),
  ).toBeVisible();
  await expect(draft).toHaveValue('9');
  await expect(page.locator('output')).toContainText('Requests: 0');
});
test('failed submitted work dismissed from its editor reports feature feedback', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Fail next save', exact: true }).click();
  await page.getByRole('button', { name: 'Edit amount item-0', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Amount in kg' }).fill('8');
  await page.getByRole('button', { name: 'Save amount' }).click();
  await page.keyboard.press('Escape');
  await expect(
    page.getByRole('alert').filter({ hasText: 'item-0: Simulated server' }),
  ).toBeVisible();
});
