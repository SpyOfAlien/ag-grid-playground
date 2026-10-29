import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const controls = (page: Page) => page.getByRole('group', { name: 'Table controls' });
const railHeader = (page: Page, group: string) =>
  page.locator(`.ag-header-cell.signal-rail[col-id="${group}__rail"] app-rail-label-header`);
/** RailLabelHeader's two children: the badge (hidden from screen readers), then the name. */
const badge = (page: Page, group: string) => railHeader(page, group).locator('> span').first();
const railName = (page: Page, group: string) => railHeader(page, group).locator('> span').nth(1);

function scrollGrid(page: Page, top: number, left: number): Promise<void> {
  return page.evaluate(
    ([scrollTop, scrollLeft]) => {
      const viewport = document.querySelector('.ag-grid-viewport')!;
      viewport.scrollTop = scrollTop;
      viewport.scrollLeft = scrollLeft;
    },
    [top, left],
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/rail-header-label');
  await expect(page.getByRole('grid', { name: 'Signal data' })).toBeVisible();
  await expect(railHeader(page, 'geA')).toBeVisible();
  await expect(page.locator('.ag-row').first()).toBeVisible();
});

test('the rail header draws badge, name and rail down to the bottom of the table', async ({
  page,
}) => {
  const rail = railHeader(page, 'geA');
  await expect(railName(page, 'geA')).toHaveText('For GE Internal Data');
  const { railBottom, tableBottom, scrollHeight, contentHeight } = await rail.evaluate((el) => {
    const viewport = document.querySelector('.ag-grid-viewport')!;
    return {
      railBottom: el.getBoundingClientRect().bottom,
      tableBottom: viewport.getBoundingClientRect().bottom,
      scrollHeight: viewport.scrollHeight,
      contentHeight:
        document.querySelector('.ag-header')!.getBoundingClientRect().height +
        document.querySelector('.ag-grid-scrolling-container')!.getBoundingClientRect().height,
    };
  });
  expect(railBottom).toBeGreaterThanOrEqual(tableBottom);
  // It reaches past the bottom without making the table any taller than header + rows.
  expect(scrollHeight).toBeLessThanOrEqual(Math.ceil(contentHeight) + 1);
});

test('a group without changes keeps the badge space empty', async ({ page }) => {
  await expect(badge(page, 'geA')).toHaveCSS('visibility', 'hidden');
  await expect(badge(page, 'hmiGe')).toHaveCSS('visibility', 'visible');
  await expect(badge(page, 'hmiGe')).toHaveText(/^[1-9]\d*$/);
});

test('the name stays put while the rows scroll: it lives in the sticky header', async ({
  page,
}) => {
  const name = railName(page, 'wiring');
  const before = await name.boundingBox();
  await scrollGrid(page, 800, 0);
  await expect.poll(async () => (await name.boundingBox())?.y).toBe(before?.y);
});

test('the rails header row is cut at the pinned edge, by the browser, as it scrolls', async ({
  page,
}) => {
  const clip = page.locator('.ag-header-row-column > .ag-grid-scrolling-cells');
  // A scroll-driven animation, not a script: it moves in the same frame as the scrolling.
  expect(
    await clip.evaluate((el) => el.getAnimations().map((a) => a.timeline?.constructor.name)),
  ).toEqual(['ScrollTimeline']);
  for (const left of [0, 137, 900]) {
    await scrollGrid(page, 0, left);
    await expect
      .poll(
        () =>
          clip.evaluate((el) => {
            const scrollLeft = document.querySelector('.ag-grid-viewport')!.scrollLeft;
            const inset = getComputedStyle(el).clipPath.match(/(-?[\d.]+)px\)$/)?.[1];
            return Math.abs(Number(inset) - scrollLeft);
          }),
        { message: `scrollLeft ${left}` },
      )
      .toBeLessThan(0.5);
  }
});

test('a rail scrolled under No# shows nothing left of the pinned edge', async ({ page }) => {
  // Put the first rail half under the pinned column, then check what's painted just left of
  // the edge, below the header: the pinned cells, not the rail.
  const { x, y } = await page.evaluate(() => {
    const viewport = document.querySelector('.ag-grid-viewport')!;
    const rail = [...document.querySelectorAll('.ag-header-cell.signal-rail')].sort(
      (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left,
    )[0];
    const pinned = document
      .querySelector('.ag-header-row-column .ag-grid-pinned-left-cells')!
      .getBoundingClientRect();
    viewport.scrollLeft += rail.getBoundingClientRect().left - pinned.right + 24;
    const header = document.querySelector('.ag-header')!.getBoundingClientRect();
    return { x: pinned.right - 4, y: header.bottom + 20 };
  });
  await page.waitForTimeout(100);
  const topmost = await page.evaluate(
    ([px, py]) =>
      document
        .elementFromPoint(px, py)
        ?.closest('.ag-grid-pinned-left-cells, app-rail-label-header')?.tagName ?? '',
    [x, y],
  );
  expect(topmost).toBe('DIV');
});

test('the chevron opens a rail and the open header closes it again', async ({ page }) => {
  const group = page.locator('.ag-header-group-cell.signal-group[col-id^="geA_"]');
  await expect(group).toHaveAttribute('aria-expanded', 'false');
  await group.locator('.ag-header-expand-icon:not(.ag-hidden)').click();
  await expect(group).toHaveAttribute('aria-expanded', 'true');
  await expect(railHeader(page, 'geA')).toHaveCount(0);
  await group.locator('.ag-header-expand-icon:not(.ag-hidden)').click();
  await expect(railHeader(page, 'geA')).toBeVisible();
});

test('passes axe, collapsed and expanded', async ({ page }) => {
  for (const state of ['Collapse all', 'Expand all'] as const) {
    await controls(page).getByRole('button', { name: state }).click();
    const results = await new AxeBuilder({ page }).include('app-rail-header-label').analyze();
    expect(results.violations, state).toEqual([]);
  }
});

test.describe('edit mode: header checkboxes and Replace Value', () => {
  const header = (page: Page, colId: string) =>
    page.locator(`.ag-header-cell[col-id="${colId}"]:not(.ag-floating-filter)`);
  const tick = (page: Page, name: string) =>
    page.getByRole('checkbox', { name: `Tick ${name} for Replace Value` });
  const dialog = (page: Page) => page.getByRole('dialog', { name: 'Replace Value' });
  const chips = (page: Page) => dialog(page).locator('.p-chip-label');
  const cellText = (page: Page, rowIndex: number, colId: string) =>
    page.locator(`.ag-row[row-index="${rowIndex}"] [col-id="${colId}"]`).textContent();

  /**
   * Right-click where the header is on screen. locator.click() would first scroll it into view,
   * and for the sticky header that scrolls the table back to the top.
   */
  async function rightClick(page: Page, colId: string): Promise<void> {
    const box = (await header(page, colId).boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height - 16, { button: 'right' });
  }

  async function openReplaceFrom(page: Page, colId: string): Promise<void> {
    await rightClick(page, colId);
    await page.getByRole('menuitem', { name: 'Replace Value' }).click();
    await expect(dialog(page)).toBeVisible();
    // Let the menu and the popup finish animating (axe reads colours mid-fade otherwise).
    await expect(page.locator('.p-contextmenu')).toHaveCount(0);
    await expect(dialog(page)).toHaveCSS('opacity', '1');
  }

  test.beforeEach(async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).click();
  });

  test('data column headers get a checkbox; No#, Revision and rails do not', async ({ page }) => {
    await expect(tick(page, 'Signal Type')).toBeVisible();
    await expect(header(page, '__rowNo').getByRole('checkbox')).toHaveCount(0);
    await expect(header(page, '__revision').getByRole('checkbox')).toHaveCount(0);
    await expect(page.locator('.ag-header-cell.signal-rail').getByRole('checkbox')).toHaveCount(0);
    await tick(page, 'Signal Type').check();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.locator('app-column-header-label p-checkbox')).toHaveCount(0);
    // Leaving edit mode clears the ticks.
    await page.getByRole('button', { name: 'Edit' }).click();
    await expect(tick(page, 'Signal Type')).not.toBeChecked();
  });

  test('right-click on a data header opens a menu with only Replace Value', async ({ page }) => {
    await rightClick(page, 'signalType');
    await expect(page.getByRole('menuitem')).toHaveText(['Replace Value']);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    // Not on columns without a checkbox, nor outside edit mode.
    await rightClick(page, '__rowNo');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
    await page.getByRole('button', { name: 'Done' }).click();
    await rightClick(page, 'signalType');
    await expect(page.getByRole('menuitem')).toHaveCount(0);
  });

  test('the popup starts with the right-clicked and ticked columns, in table order', async ({
    page,
  }) => {
    await tick(page, 'Equipment Type').check();
    await tick(page, 'Signal Type').check();
    await openReplaceFrom(page, 'areaShort');
    await expect(chips(page)).toHaveText([
      'Signal Type',
      'Area Ref/Bay Ref Short Name',
      'Equipment Type',
    ]);
  });

  test('Confirm needs a value and a column; columns are added and removed', async ({ page }) => {
    await openReplaceFrom(page, 'signalType');
    const confirm = dialog(page).getByRole('button', { name: 'Confirm' });
    await expect(confirm).toBeDisabled();
    await dialog(page).getByRole('textbox', { name: 'Value' }).fill('   ');
    await expect(confirm).toBeDisabled();
    await dialog(page).getByRole('textbox', { name: 'Value' }).fill('Mix');
    await expect(confirm).toBeEnabled();
    await dialog(page)
      .getByRole('button', { name: /remove/i })
      .click();
    await expect(chips(page)).toHaveCount(0);
    await expect(confirm).toBeDisabled();
    await dialog(page).getByRole('combobox', { name: 'Search or add a Column' }).fill('remar');
    await dialog(page).getByRole('button', { name: 'Add Column' }).click();
    await expect(chips(page)).toHaveText(['Remarks']);
    await expect(confirm).toBeEnabled();
  });

  test('Replace is a draft on loaded rows, kept in place, and on rows loaded later', async ({
    page,
  }) => {
    await scrollGrid(page, 200, 0);
    const scrollTop = () =>
      page.evaluate(() => document.querySelector('.ag-grid-viewport')!.scrollTop);
    // The grid settles the offset while the next blocks load; measure once it has.
    let before = -1;
    await expect
      .poll(async () => {
        const now = await scrollTop();
        const settled = now === before;
        before = now;
        return settled;
      })
      .toBe(true);
    await openReplaceFrom(page, 'signalType');
    await dialog(page).getByRole('textbox', { name: 'Value' }).fill('Mix');
    await dialog(page).getByRole('button', { name: 'Confirm' }).click();
    await expect(dialog(page)).toBeHidden();
    await expect.poll(() => cellText(page, 5, 'signalType')).toBe('Mix');
    // No reload: the table kept its scroll position.
    expect(await scrollTop()).toBe(before);
    // Row 59 is in a block (20 rows each) not loaded when Replace was confirmed.
    await expect(page.locator('.ag-row[row-index="59"]')).toHaveCount(0);
    await scrollGrid(page, 99999, 0);
    await expect.poll(() => cellText(page, 59, 'signalType')).toBe('Mix');
    // Other columns are untouched.
    expect(await cellText(page, 59, 'equipmentType')).not.toBe('Mix');
  });

  test('from the keyboard: the menu opens under the header, focus comes back', async ({ page }) => {
    await header(page, 'signalType').focus();
    // The context-menu key / Shift+F10: a contextmenu event without a pointer position.
    await header(page, 'signalType').evaluate((el) =>
      el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 0, clientY: 0 })),
    );
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const headerBox = (await header(page, 'signalType').boundingBox())!;
    const menuBox = (await menu.boundingBox())!;
    expect(Math.abs(menuBox.y - (headerBox.y + headerBox.height))).toBeLessThan(8);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(dialog(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toBeHidden();
    await expect(header(page, 'signalType')).toBeFocused();
  });

  test('passes axe in edit mode, with the popup open', async ({ page }) => {
    await tick(page, 'Signal Type').check();
    expect(
      (await new AxeBuilder({ page }).include('app-rail-header-label').analyze()).violations,
    ).toEqual([]);
    await openReplaceFrom(page, 'equipmentType');
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
