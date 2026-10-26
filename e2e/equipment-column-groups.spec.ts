import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const group = (page: Page, id: string) => page.locator(`.ag-header-group-cell[col-id="${id}_0"]`);
const header = (page: Page, id: string) =>
  page.locator(`.ag-header-cell[col-id="${id}"]:not(.ag-floating-filter)`);

const controls = (page: Page) => page.getByRole('group', { name: 'Table controls' });
const control = (page: Page, name: string) =>
  controls(page).getByRole('button', { name, exact: true });

async function toggleGroup(page: Page, id: string): Promise<void> {
  await group(page, id).locator('.ag-header-expand-icon:visible').click();
}

/** Uses the single Expand all / Collapse all toggle, flipping it first when needed. */
async function setAllGroups(page: Page, open: boolean): Promise<void> {
  const [action, next] = open ? ['Expand all', 'Collapse all'] : ['Collapse all', 'Expand all'];
  if (await control(page, next).isVisible()) {
    await control(page, next).click();
  }
  await control(page, action).click();
  await expect(control(page, next)).toBeVisible();
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
  await setAllGroups(page, false);
  await expect(header(page, 'clinical-rail')).toBeVisible();
  await expect(header(page, 'bed')).toHaveCount(0);
  await expect(page.locator('.cdk-live-announcer-element')).toHaveText(
    'All column groups collapsed.',
  );
  await setAllGroups(page, true);
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

  await setAllGroups(page, false);
  await setAllGroups(page, true);
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

test('the page shows only the table and its toolbar', async ({ page }) => {
  // Only the toolbar (title + table controls) and the grid are on the page.
  await expect(page.locator('main > :not(.equipment-toolbar, ag-grid-angular)')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hospital equipment');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // Some groups start collapsed, so the toggle offers Expand all.
  await expect(controls(page).getByRole('button')).toHaveText([
    'Expand all',
    'Setting column',
    'Full Screen',
    'Add Column',
    'Add Row',
  ]);
  await expect(control(page, 'Setting column')).toBeDisabled();
  await expect(control(page, 'Add Column')).toBeDisabled();
  // The app shell's demo nav sits outside the page.
  await expect(page.getByRole('main').getByRole('navigation')).toHaveCount(0);
});

test('the group toggle label follows manual expansion', async ({ page }) => {
  await setAllGroups(page, true);
  await toggleGroup(page, 'maintenance');
  await expect(control(page, 'Expand all')).toBeVisible();
  await toggleGroup(page, 'maintenance');
  await expect(control(page, 'Collapse all')).toBeVisible();
  // Focus stays on the toggle after it flips.
  await control(page, 'Collapse all').click();
  await expect(control(page, 'Expand all')).toBeFocused();
});

test('Hide Filter/Search hides the filter row and keeps typed filters', async ({ page }) => {
  const hideFilters = controls(page).getByLabel('Hide Filter/Search');
  await page.locator('.ag-floating-filter[col-id="deviceType"] input').fill('Infusion Pump');
  await expect(page.locator('.ag-row[row-id="1"]')).toHaveCount(0);
  await hideFilters.check();
  await expect(page.locator('.ag-floating-filter')).toHaveCount(0);
  await expect(page.locator('.ag-row[row-id="1"]')).toHaveCount(0);
  await hideFilters.uncheck();
  await expect(page.locator('.ag-floating-filter[col-id="deviceType"] input')).toHaveValue(
    'Infusion Pump',
  );
});

test('Add Row appends a blank row and announces it', async ({ page }) => {
  await control(page, 'Add Row').click();
  const added = page.locator('.ag-row[row-id="25"]');
  await expect(added.first()).toBeVisible();
  await expect(added.locator('.ag-cell[col-id="deviceType"]')).toHaveText('');
  await expect(added.locator('app-revised-cell')).toHaveCount(0);
  await expect(page.locator('.cdk-live-announcer-element')).toHaveText('Row 25 added.');
});

test('Full Screen toggles the table in and out of full screen', async ({ page }) => {
  await control(page, 'Full Screen').click();
  await expect(control(page, 'Exit Full Screen')).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement?.className)).toContain(
    'equipment-demo',
  );
  await control(page, 'Exit Full Screen').click();
  await expect(control(page, 'Full Screen')).toBeVisible();
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
});

test('has no axe violations in the reference, collapsed, expanded and mobile layouts', async ({
  page,
}) => {
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await setAllGroups(page, false);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await setAllGroups(page, true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await controls(page).getByLabel('Hide Filter/Search').check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('grid', { name: 'Hospital equipment' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
