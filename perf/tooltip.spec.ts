import { test, type Page } from '@playwright/test';

// The same 300 × 200 grid with a tooltip on every cell: none, the cells kit tooltip, matTooltip.
type Perf = Record<'firstRender' | 'scroll' | 'refresh', () => Promise<number>> &
  Record<'cells', () => number>;
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const call = (page: Page, name: keyof Perf) =>
  page.evaluate((key) => (window as unknown as { tooltipPerf: Perf }).tooltipPerf[key](), name);

async function heapMb(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('HeapProfiler.collectGarbage');
  const { usedSize } = await cdp.send('Runtime.getHeapUsage');
  return usedSize / 1024 / 1024;
}

async function listeners(page: Page): Promise<number> {
  const cdp = await page.context().newCDPSession(page);
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: 'Array.from(document.querySelectorAll("app-tip-cell, app-tip-cell *"))',
  });
  const { result: document } = await cdp.send('Runtime.evaluate', { expression: 'document' });
  let count = (await cdp.send('DOMDebugger.getEventListeners', { objectId: document.objectId! }))
    .listeners.length;
  const { result: items } = await cdp.send('Runtime.getProperties', {
    objectId: result.objectId!,
    ownProperties: true,
  });
  for (const item of items)
    if (item.value?.objectId && /^\d+$/.test(item.name))
      count += (await cdp.send('DOMDebugger.getEventListeners', { objectId: item.value.objectId }))
        .listeners.length;
  return count;
}

test('tooltip cost: none vs cells kit vs matTooltip', async ({ page }) => {
  const lines: string[] = [];
  for (const mode of ['none', 'cells', 'mat']) {
    const render: number[] = [];
    const scroll: number[] = [];
    const refresh: number[] = [];
    const heap: number[] = [];
    let cells = 0;
    let listenerCount = 0;
    for (let run = 0; run < 5; run++) {
      await page.goto(`/tooltip-perf?mode=${mode}`);
      await page.waitForFunction(() => 'tooltipPerf' in window);
      render.push(await call(page, 'firstRender'));
      cells = await call(page, 'cells');
      heap.push(await heapMb(page));
      if (run === 0) listenerCount = await listeners(page);
      scroll.push(await call(page, 'scroll'));
      refresh.push(await call(page, 'refresh'));
    }
    lines.push(
      `${mode.padEnd(5)} cells ${cells}  first render ${median(render).toFixed(0)} ms  ` +
        `scroll sweep ${median(scroll).toFixed(0)} ms  refresh all ${median(refresh).toFixed(0)} ms  ` +
        `heap ${median(heap).toFixed(1)} MB  listeners ${listenerCount}`,
    );
  }
  console.log(
    `\n== tooltip cost (300 rows × 200 columns, every cell has a tooltip) ==\n${lines.join('\n')}`,
  );
});
