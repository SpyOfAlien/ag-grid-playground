import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const group = (page: Page, id: string) => page.locator(`.ag-header-group-cell[col-id="${id}_0"]`);
const header = (page: Page, id: string) =>
  page.locator(`.ag-header-cell[col-id="${id}"]:not(.ag-floating-filter)`);

// The toolbar renders above the table and again mid-page below it; tests use the top copy
// unless they say otherwise.
const controls = (page: Page, name = 'Top table controls') =>
  page.getByRole('group', { name, exact: true });
const control = (page: Page, name: string) =>
  controls(page).getByRole('button', { name, exact: true });

async function toggleGroup(page: Page, id: string): Promise<void> {
  await group(page, id).locator('.ag-header-expand-icon:visible').click();
}

const menuSwitch = (page: Page, name: string) =>
  controls(page).getByRole('switch', { name, exact: true });

const groupView = (page: Page, name: 'Expand all' | 'Collapse all' | 'Custom') =>
  controls(page).getByRole('radio', { name, exact: true });

/** Picks Expand all or Collapse all in the Columns menu, then closes the menu. */
async function setAllGroups(page: Page, open: boolean): Promise<void> {
  await control(page, 'Columns').click();
  await groupView(page, open ? 'Expand all' : 'Collapse all').check();
  await page.keyboard.press('Escape');
  await expect(control(page, 'Columns')).toHaveAttribute('aria-expanded', 'false');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/equipment-column-groups');
  await expect(page.getByRole('grid', { name: 'Hospital equipment' })).toBeVisible();
});

test('nested groups collapse to rails and reopen with keyboard and mouse', async ({ page }) => {
  // Every group starts collapsed, nested ones included.
  await expect(header(page, 'maintenance-rail')).toBeVisible();
  await expect(header(page, 'clinical-rail')).toBeVisible();
  await expect(header(page, 'bed')).toHaveCount(0);
  await toggleGroup(page, 'clinical');
  await expect(header(page, 'usage-rail')).toBeVisible();
  await expect(header(page, 'location-rail')).toBeVisible();
  await toggleGroup(page, 'location');
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
  await toggleGroup(page, 'clinical');
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

test('the page shows only the table and its toolbars', async ({ page }) => {
  // The first screen holds the title, controls and grid; a second toolbar sits mid-page below.
  await expect(page.locator('main > *')).toHaveCount(2);
  await expect(
    page.locator('main > .equipment-screen > :not(.equipment-toolbar, ag-grid-angular)'),
  ).toHaveCount(0);
  await expect(page.locator('main > .equipment-lower-toolbar')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Hospital equipment');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(controls(page).getByRole('button')).toHaveText([
    'Columns',
    'Full Screen',
    'Add Row',
  ]);
  await expect(controls(page, 'Bottom table controls').getByRole('button')).toHaveText([
    'Columns',
    'Full Screen',
    'Add Row',
  ]);
  // Column controls live in the Columns menu, by category.
  await control(page, 'Columns').click();
  const sections = controls(page)
    .getByRole('group', { name: 'Columns', exact: true })
    .getByRole('group');
  await expect(sections).toHaveCount(3);
  for (const [index, category] of ['Manage', 'Column groups', 'Show columns'].entries()) {
    await expect(sections.nth(index)).toHaveAccessibleName(category);
  }
  await expect(control(page, 'Setting column')).toBeDisabled();
  await expect(control(page, 'Add Column')).toBeDisabled();
  await expect(
    sections.nth(1).getByRole('button', { name: 'Add Column Group', exact: true }),
  ).toBeDisabled();
  await expect(sections.first().getByRole('switch')).toHaveAccessibleName('Hide Filter/Search');
  await expect(menuSwitch(page, 'Hide Filter/Search')).not.toBeChecked();
  // The app shell's demo nav sits outside the page.
  await expect(page.getByRole('main').getByRole('navigation')).toHaveCount(0);
});

test('Custom switches one group at a time and follows header toggles', async ({ page }) => {
  // Collapse all is the starting view; group switches only show under Custom.
  await control(page, 'Columns').click();
  await expect(groupView(page, 'Collapse all')).toBeChecked();
  await expect(menuSwitch(page, 'Maintenance')).toHaveCount(0);
  await groupView(page, 'Expand all').check();
  await expect(header(page, 'maintenance-rail')).toHaveCount(0);
  await groupView(page, 'Custom').check();
  await expect(menuSwitch(page, 'Maintenance')).toBeChecked();
  await menuSwitch(page, 'Maintenance').click();
  await expect(header(page, 'maintenance-rail')).toBeVisible();
  await expect(menuSwitch(page, 'Maintenance')).not.toBeChecked();
  // Nested groups are listed too; groups without columns are not.
  await expect(menuSwitch(page, 'Bedside Location')).toBeChecked();
  await expect(menuSwitch(page, 'Archived')).toHaveCount(0);
  // Escape closes the menu and returns focus to its button.
  await page.keyboard.press('Escape');
  await expect(control(page, 'Columns')).toBeFocused();
  await expect(menuSwitch(page, 'Maintenance')).toHaveCount(0);
  // Opening a group from its header updates its switch.
  await toggleGroup(page, 'maintenance');
  await control(page, 'Columns').click();
  await expect(menuSwitch(page, 'Maintenance')).toBeChecked();
  // Collapse all hides the switches again; a header toggle after it turns the view Custom.
  await groupView(page, 'Collapse all').check();
  await expect(menuSwitch(page, 'Maintenance')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await toggleGroup(page, 'maintenance');
  await control(page, 'Columns').click();
  await expect(groupView(page, 'Custom')).toBeChecked();
  await expect(menuSwitch(page, 'Maintenance')).toBeChecked();
  // A click outside closes the menu.
  await page.getByRole('heading', { level: 1 }).click();
  await expect(menuSwitch(page, 'Maintenance')).toHaveCount(0);
});

test('Show columns hides and shows columns, with search', async ({ page }) => {
  const column = (name: string) => controls(page).getByRole('checkbox', { name, exact: true });
  const search = controls(page).getByRole('searchbox', { name: 'Search columns' });
  await control(page, 'Columns').click();
  const panel = controls(page).getByRole('group', { name: 'Columns', exact: true });
  // Row number and rails are not listed; search matches group names too.
  await expect(column('No#')).toHaveCount(0);
  await search.fill('maintenance');
  await expect(panel.getByRole('checkbox')).toHaveCount(2);
  await expect(column('Work Order Maintenance')).toBeChecked();
  await search.fill('zzz');
  await expect(panel.getByText('No columns match "zzz".')).toBeVisible();
  await search.fill('device');
  await column('Device Type').uncheck();
  await expect(header(page, 'deviceType')).toHaveCount(0);
  // Reopening the menu keeps the state, and the column can come back.
  await page.keyboard.press('Escape');
  await control(page, 'Columns').click();
  await expect(column('Device Type')).not.toBeChecked();
  await column('Device Type').check();
  await expect(header(page, 'deviceType')).toBeVisible();
});

test('the toolbar mid-page below the table is reached by scrolling and shares state', async ({
  page,
}) => {
  const bottom = controls(page, 'Bottom table controls');
  const button = bottom.getByRole('button', { name: 'Columns', exact: true });
  // It sits a screen's height below the table, with as much page again below it.
  await expect(button).not.toBeInViewport();
  const scrollHeight = await page.evaluate(() => document.scrollingElement!.scrollHeight);
  const viewportHeight = page.viewportSize()!.height;
  expect(scrollHeight).toBeGreaterThan(viewportHeight * 3);
  // Scrolled to the top of the window, its menu opens downwards.
  await button.evaluate((element) => element.scrollIntoView({ block: 'start' }));
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await button.click();
  const panel = bottom.getByRole('group', { name: 'Columns', exact: true });
  await expect(panel).toBeInViewport();
  expect((await panel.boundingBox())!.y).toBeGreaterThan((await button.boundingBox())!.y);
  // Scrolled to the bottom of the window, with no room below, it opens upwards.
  await button.click();
  await button.evaluate((element) => element.scrollIntoView({ block: 'end' }));
  await button.click();
  await expect(panel).toBeInViewport();
  expect((await panel.boundingBox())!.y).toBeLessThan((await button.boundingBox())!.y);
  // Both toolbars drive the same table.
  await bottom.getByRole('radio', { name: 'Expand all', exact: true }).check();
  await expect(header(page, 'maintenance-rail')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(button).toBeFocused();
  await page.evaluate(() => window.scrollTo(0, 0));
  await control(page, 'Columns').click();
  await expect(groupView(page, 'Expand all')).toBeChecked();
  // The top menu still opens downwards.
  const topPanel = controls(page).getByRole('group', { name: 'Columns', exact: true });
  expect((await topPanel.boundingBox())!.y).toBeGreaterThan(
    (await control(page, 'Columns').boundingBox())!.y,
  );
});

test('Hide Filter/Search hides the filter row and keeps typed filters', async ({ page }) => {
  const hideFilters = menuSwitch(page, 'Hide Filter/Search');
  await page.locator('.ag-floating-filter[col-id="deviceType"] input').fill('Infusion Pump');
  await expect(page.locator('.ag-row[row-id="1"]')).toHaveCount(0);
  await control(page, 'Columns').click();
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
  // Menu open, with the filter row hidden.
  await control(page, 'Columns').click();
  await menuSwitch(page, 'Hide Filter/Search').check();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('grid', { name: 'Hospital equipment' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
