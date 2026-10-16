import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function controls(page: Page) {
  await page.goto('/grid-demo');
  await expect(page.getByRole('button', { name: 'Reset demo' })).toBeEnabled();
  await page.locator('.ag-grid-viewport').evaluate((element) => (element.scrollLeft = 650));
  const row = page.locator('.ag-row[row-id="row-00001"]');
  const toggle = row.locator('[col-id="review-toggle"] button');
  const dropdown = row.locator('[col-id="unit-dropdown"] button');
  await expect(toggle).toBeVisible();
  await expect(dropdown).toBeVisible();
  return { row, toggle, dropdown };
}
test('client toggle refreshes review/permissions and dropdown refreshes dependent units without HTTP or pen actions', async ({
  page,
}) => {
  const { row, toggle, dropdown } = await controls(page);
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(dropdown).toHaveAttribute('aria-disabled', 'true');
  await expect(dropdown).toHaveAttribute('title', 'Review this row before editing');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await dropdown.click();
  const popup = page.locator('.kit-popover-panel');
  await popup.getByRole('option', { name: 'Metric tonnes (t)' }).focus();
  await page.keyboard.press('Space');
  await expect(popup).toHaveCount(0);
  await expect(dropdown).toHaveText('Metric tonnes (t)');
  await expect(row.locator('[col-id="metric-2"] .grid-cell-content')).toHaveText('2.62 t');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 0');
  await expect(row.locator('[col-id="review-toggle"] .grid-cell-action')).toHaveCount(0);
  await expect(row.locator('[col-id="unit-dropdown"] .grid-cell-action')).toHaveCount(0);
});
test('dropdown options mount on demand, block background scrolling, restore focus on Escape, truncate labels, and pass accessibility checks', async ({
  page,
}) => {
  const { dropdown } = await controls(page);
  await expect(page.locator('app-dropdown-options')).toHaveCount(0);
  await dropdown.focus();
  await page.keyboard.press('Enter');
  const popup = page.locator('.kit-popover-panel');
  await expect(popup).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Cancel', exact: true })).toHaveCount(0);
  await expect(popup.locator('mat-pseudo-checkbox')).toHaveCount(0);
  const selected = popup.getByRole('option', { name: 'Kilograms (kg)' });
  await expect(selected).toHaveAttribute('aria-selected', 'true');
  await expect(selected).toHaveClass(/selected/);
  const viewport = page.locator('.ag-grid-viewport');
  const before = await viewport.evaluate((element) => ({
    left: element.scrollLeft,
    top: element.scrollTop,
  }));
  const gridBox = (await page.locator('ag-grid-angular').boundingBox())!;
  await page.mouse.move(gridBox.x + 50, gridBox.y + 50);
  await page.mouse.wheel(500, 500);
  await expect
    .poll(() =>
      viewport.evaluate((element) => ({ left: element.scrollLeft, top: element.scrollTop })),
    )
    .toEqual(before);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(dropdown).toBeFocused();
  expect(await dropdown.evaluate((element) => getComputedStyle(element).textOverflow)).toBe(
    'ellipsis',
  );
});
test('server toggle keeps committed state while pending, rejects repeated activation, and recovers from failure', async ({
  page,
}) => {
  const { toggle } = await controls(page);
  await page.getByLabel('Persistence mode').selectOption('server');
  await page.getByLabel('API response').selectOption('failure');
  await toggle.click();
  await expect(page.getByTestId('edit-pending')).toHaveText('Pending edits: 1');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await toggle.dispatchEvent('click');
  await expect(page.getByRole('status')).toHaveText('Edit failed: Demo server rejected this edit.');
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 1');
  await page.getByLabel('API response').selectOption('success');
  await toggle.focus();
  await page.keyboard.press('Space');
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 2');
});
test('server dropdown failure retains committed selection and supports retry after close', async ({
  page,
}) => {
  const { dropdown } = await controls(page);
  await page.getByLabel('Persistence mode').selectOption('server');
  await page.getByLabel('API response').selectOption('failure');
  await dropdown.click();
  const popup = page.locator('.kit-popover-panel');
  await popup.getByRole('option', { name: 'Metric tonnes (t)' }).click();
  await expect(dropdown).toHaveText('Kilograms (kg)');
  await expect(popup.getByRole('alert')).toHaveText('Demo server rejected this edit.');
  await expect(popup.getByRole('option', { name: 'Kilograms (kg)' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(popup.getByRole('option', { name: 'Metric tonnes (t)' })).toHaveAttribute(
    'aria-selected',
    'false',
  );
  await page.keyboard.press('Escape');
  await page.getByLabel('API response').selectOption('success');
  await dropdown.click();
  await popup.getByRole('option', { name: 'Metric tonnes (t)' }).click();
  await expect(popup).toHaveCount(0);
  await expect(dropdown).toHaveText('Metric tonnes (t)');
  await expect(page.getByTestId('demo-api-calls')).toHaveText('Demo API calls: 2');
});
test('dropdown save continues after Escape and backdrop dismissal releases background scroll blocking', async ({
  page,
}) => {
  const { dropdown } = await controls(page);
  await page.getByLabel('Persistence mode').selectOption('server');
  await dropdown.click();
  const popup = page.locator('.kit-popover-panel');
  await popup.getByRole('option', { name: 'Metric tonnes (t)' }).click();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(dropdown).toHaveText('Metric tonnes (t)');
  await expect(page.getByRole('status')).toHaveText('Server edit saved: row-00001.');
  await dropdown.click();
  await page.locator('.cdk-overlay-backdrop').click({ position: { x: 10, y: 10 } });
  await expect(popup).toHaveCount(0);
});
