import { test } from '@playwright/test';

// 200 columns × 300 tree rows on /cells-perf. Prints main-thread time (change, AG Grid update
// and change detection) and how many cell renderers were refreshed.
type Sample = { ms: number; refreshes: number };
type Perf = Record<'ready', () => Promise<number>> &
  Record<'baseline' | 'update' | 'replace' | 'serverReplace', () => Promise<Sample>>;
const median = (values: number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

for (const allColumns of [false, true])
  test(`refresh cost, ${allColumns ? 'all 200 columns drawn' : 'virtualised columns'}`, async ({
    page,
  }) => {
    await page.goto(`/cells-perf${allColumns ? '?allColumns' : ''}`);
    await page.waitForFunction(() => 'cellsPerf' in window);
    const rendered = await page.evaluate(() =>
      (window as unknown as { cellsPerf: Perf }).cellsPerf.ready(),
    );
    const lines = [`cell renderers drawn: ${rendered}`];
    for (const kind of ['baseline', 'update', 'replace', 'serverReplace'] as const) {
      const samples: Sample[] = [];
      for (let run = 0; run < 12; run++)
        samples.push(
          await page.evaluate(
            (name) => (window as unknown as { cellsPerf: Perf }).cellsPerf[name](),
            kind,
          ),
        );
      const timed = samples.slice(2);
      lines.push(
        `${kind.padEnd(13)} median ${median(timed.map((s) => s.ms)).toFixed(1)} ms, ` +
          `max ${Math.max(...timed.map((s) => s.ms)).toFixed(1)} ms, ` +
          `renderer refreshes ${median(timed.map((s) => s.refreshes))}`,
      );
    }
    console.log(
      `\n== ${allColumns ? 'all columns' : 'virtualised columns'} ==\n${lines.join('\n')}`,
    );
  });
