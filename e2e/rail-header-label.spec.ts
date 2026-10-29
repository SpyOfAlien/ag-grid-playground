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
