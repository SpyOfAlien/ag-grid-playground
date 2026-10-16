# Recorded performance

Measured on 2026-10-07 with an Apple M2, arm64 macOS Darwin 24.6.0, headless Chrome 154.0.8037.98 and the Angular development server. Both configurations use the same current application bundle and 1,000 fixture rows at a 1700 × 1000 viewport.

Historical Phase 1 timings were not captured. The display configuration is reconstructed as two columns in the current application. It cannot establish a historical bundle or bootstrap regression. Initial timings also include Playwright waiting overhead and warm-cache/order effects, so the lower complete-system number is not evidence of an improvement.

| Median of three runs                           | Reconstructed display | Complete system |
| ---------------------------------------------- | --------------------: | --------------: |
| Navigation to first rendered cell observation  |              113.4 ms |         93.9 ms |
| Visible cells at initial observation           |                    26 |              91 |
| Rendered cells including virtualization buffer |                    46 |             161 |
| 120 scrolling frames                           |             1982.9 ms |       1988.3 ms |
| Scrolling frame interval, p95                  |               17.9 ms |         17.9 ms |
| 30 precision signal changes, one per frame     |              491.7 ms |        487.7 ms |

The complete layout renders 3.5 times as many initial cells. The recorded scrolling frame intervals did not show a difference against the reconstructed display configuration. These are frame intervals from a requestAnimationFrame-paced sequence, not CPU render duration, a performance budget or proof that larger datasets have the same cost. Signal measurements likewise include frame pacing. Repeat the sequence on target hardware before using these numbers as release criteria.

Twenty popover open/Escape cycles took 729 ms including Playwright overhead and left zero overlay panes. Lifecycle tests separately verify ownership cleanup, initialization-time close and pending dismissal.

Run the dedicated test alone to avoid concurrent test workers distorting the measurements:

```sh
../../node_modules/.bin/playwright test --config playwright.config.ts browser/performance.spec.ts --workers=1
```

`performance-results.json` contains every run, environment details, visible and rendered cell counts, the exact scrolling sequence and editor cycle results. The next run replaces that file. `?baseline=1` exposes the reconstructed display configuration for inspection.
