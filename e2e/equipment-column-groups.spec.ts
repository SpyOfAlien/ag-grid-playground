import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const group = (page: Page, id: string) => page.locator(`.ag-header-group-cell[col-id="${id}_0"]`);
const header = (page: Page, id: string) =>
  page.locator(`.ag-header-cell[col-id="${id}"]:not(.ag-floating-filter)`);

async function toggleGroup(page: Page, id: string): Promise<void> {
  await group(page, id).locator('.ag-header-expand-icon:visible').click();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/equipment-column-groups');
  await expect(page.getByRole('grid', { name: 'Hospital equipment' })).toBeVisible();
});

test('nested groups collapse to rails and reopen with keyboard and mouse', async ({ page }) => {
  await expect(header(page, 'maintenance-rail')).toBeVisible();
  await expect(header(page, 'usage-rail')).toBeVisible();
  await expect(header(page, 'bed')).toBeVisible();
  await toggleGroup(page, 'location');
  await expect(header(page, 'bed')).toHaveCount(0);
  await expect(header(page, 'location-rail')).toBeVisible();
  await toggleGroup(page, 'location');
  await expect(header(page, 'bed')).toBeVisible();
  await group(page, 'clinical').focus();
  await page.keyboard.press('Enter');
  await expect(header(page, 'clinical-rail')).toBeVisible();
  await expect(header(page, 'bed')).toHaveCount(0);
  await page.keyboard.press('Enter');
  await expect(header(page, 'bed')).toBeVisible();
  await toggleGroup(page, 'usage');
  await expect(header(page, 'assetTag')).toBeVisible();
  await toggleGroup(page, 'usage');
  await toggleGroup(page, 'maintenance');
  await expect(header(page, 'workOrder')).toBeVisible();
  await expect(header(page, 'maintenance-rail')).toHaveCount(0);
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
  await expect(header(page, 'clinical-rail')).toBeVisible();
  await expect(header(page, 'bed')).toHaveCount(0);
  await expect(page.locator('.cdk-live-announcer-element')).toHaveText(
    'All column groups collapsed.',
  );
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  await expect(header(page, 'workOrder')).toBeVisible();
  await expect(header(page, 'calibrationDue')).toBeVisible();
  await expect(page.locator('.cdk-live-announcer-element')).toHaveText(
    'All column groups expanded.',
  );
});

test('group colours follow nesting depth', async ({ page }) => {
  for (const id of ['maintenance', 'clinical', 'calibration', 'safety']) {
    await expect(group(page, id)).toHaveClass(/\bequipment-level-0\b/);
  }
  for (const id of ['usage', 'alarms', 'location']) {
    await expect(group(page, id)).toHaveClass(/\bequipment-level-1\b/);
  }
  await expect(header(page, 'maintenance-rail')).toHaveClass(/\bequipment-level-0\b/);
  await expect(header(page, 'usage-rail')).toHaveClass(/\bequipment-level-1\b/);
});

test('expanded group names are not visually clipped after mouse, keyboard or bulk expansion', async ({
  page,
}) => {
  const maintenanceName = group(page, 'maintenance').locator('.ag-header-group-text');
  await expect(maintenanceName).toHaveCSS('clip-path', 'inset(50%)');
  await toggleGroup(page, 'maintenance');
  await expect(maintenanceName).toHaveCSS('clip-path', 'none');
  await expect(maintenanceName).toContainText('Maintenance');
  await group(page, 'maintenance').focus();
  await page.keyboard.press('Enter');
  await expect(maintenanceName).toHaveCSS('clip-path', 'inset(50%)');
  await page.keyboard.press('Enter');
  await expect(maintenanceName).toHaveCSS('clip-path', 'none');

  await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  for (const id of [
    'maintenance',
    'clinical',
    'usage',
    'alarms',
    'location',
    'calibration',
    'safety',
  ]) {
    await expect(group(page, id)).toHaveAttribute('aria-expanded', 'true');
    const label = group(page, id).locator('.ag-header-group-text');
    await expect(label).toHaveCSS('clip-path', 'none');
    await expect(label).not.toHaveCSS('width', '1px');
  }
});

test('expanded groups can resize while collapsed strips stay fixed', async ({ page }) => {
  const maintenance = group(page, 'maintenance');
  const handle = maintenance.locator('.ag-header-cell-resize');
  await expect(handle).toBeHidden();
  await toggleGroup(page, 'maintenance');
  await expect(handle).toBeVisible();
  // Wait for the expansion animation and an unobstructed drag target.
  await handle.hover();
  const initialWidth = await maintenance.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  const bounds = await handle.boundingBox();
  if (!bounds) throw new Error('Expanded group resize handle is missing');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width / 2 + 80, bounds.y + bounds.height / 2, {
    steps: 8,
  });
  await page.mouse.up();
  await expect
    .poll(() => maintenance.evaluate((element) => element.getBoundingClientRect().width))
    .toBeGreaterThan(initialWidth + 60);
  await toggleGroup(page, 'maintenance');
  await expect(handle).toBeHidden();
  await expect(maintenance).toHaveCSS('width', '38px');
  await toggleGroup(page, 'maintenance');
  await expect(handle).toBeVisible();
  await expect
    .poll(() => maintenance.evaluate((element) => element.getBoundingClientRect().width))
    .toBeGreaterThan(initialWidth + 60);
});

test('only revised cells use the revised renderer', async ({ page }) => {
  const ward = (row: number) => page.locator(`.ag-row[row-id="${row}"] .ag-cell[col-id="ward"]`);
  await expect(page.locator('app-revised-cell')).toHaveCount(6);
  await expect(page.locator('app-revised-cell del').first()).toHaveText('SDU');
  await expect(page.locator('app-revised-cell ins').first()).toHaveText('ICU-N');
  await expect(ward(3).locator('app-revised-cell')).toContainText('Step-down Unit');
  await expect(ward(3)).toHaveClass(/\bequipment-revised\b/);
  await expect(ward(7).locator('app-revised-cell')).toHaveCount(0);
  await expect(ward(7)).toHaveText('ICU North');
  await expect(ward(7)).not.toHaveClass(/\bequipment-revised\b/);
});

test('filters and sorting operate on equipment data', async ({ page }) => {
  const filter = page.locator('.ag-floating-filter[col-id="deviceType"] input');
  await filter.fill('Infusion Pump');
  await expect(page.locator('.ag-row[row-id="1"]')).toHaveCount(0);
  await expect(page.locator('.ag-row[row-id="17"]').first()).toBeVisible();
  await filter.fill('');
  await expect(page.locator('.ag-row[row-id="1"]').first()).toBeVisible();
  await header(page, 'id').click();
  await expect(header(page, 'id')).toHaveAttribute('aria-sort', 'ascending');
  await header(page, 'id').click();
  await expect(header(page, 'id')).toHaveAttribute('aria-sort', 'descending');
});

test('the page shows only the table and its group controls', async ({ page }) => {
  // Only the toolbar (title + group controls) and the grid are on the page.
  await expect(page.locator('main > :not(.equipment-toolbar, ag-grid-angular)')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hospital equipment');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('toolbar', { name: 'Column groups' }).getByRole('button')).toHaveText(
    ['Expand all', 'Collapse all'],
  );
  await expect(page.getByRole('navigation')).toHaveCount(0);
});

test('has no axe violations in the reference, collapsed, expanded and mobile layouts', async ({
  page,
}) => {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Collapse all', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Expand all', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('grid', { name: 'Hospital equipment' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
