# Step 1 baseline

Recorded 2026-10-03 13:19:00 Asia/Ho_Chi_Minh. This is the ordinary-cell baseline before any shared custom renderers or editors exist.

## Environment

- Angular core/compiler: 21.2.25; CLI/build: 21.2.24; Material/CDK: 21.2.14; TypeScript: 5.9.3.
- AG Grid Angular/community/enterprise: 36.2.0. AllEnterpriseModule registered; standard cells only.
- Node: 24.11.1; npm: 11.6.2. Exact dependencies are locked in package-lock.json.
- Browser: headless Google Chrome 154.0.8037.93, isolated Playwright profile, no CPU/network throttling.
- Hardware: Apple M2, 8 logical CPUs, 16 GiB RAM; Darwin 24.6.0.
- Browser viewport: 1440 × 1000 CSS pixels. Grid viewport: 1374 × 558 CSS pixels, including the grid's sticky header/pinned regions.
- Angular development server; one browser worker. Production build verified separately.

AG Grid's [compatibility matrix](https://www.ag-grid.com/angular-data-grid/compatibility/) supports Angular 20–22 with AG Grid 28–36+. The installed 36.2.0 wrapper declares Angular >=20 peer dependencies. Angular 21 was explicitly selected during CLI scaffolding.

## Fixture and sequence

The deterministic fixture has 1,000 rows and exactly 200 columns: two pinned identity columns, one review-metadata column, and 197 numeric columns. Row height is 32px, header height 38px, row buffer 10, row animation off. Row and column virtualization are enabled. The client-side row model is a demo choice.

The browser test performs this sequence:

1. Open the lazy grid route and wait for the initial rendered data and frame queue to settle.
2. Scroll vertically to 16,000px and verify the rendered row window moves.
3. Scroll horizontally to the far right and verify the final metric and pinned IDs remain rendered.
4. Return to the origin, toggle metadata, and verify the first metric stays 0.00 while the review label changes.
5. Replace row values with fixture revision 1 and verify the first metric becomes 100.03 while the changed metadata and stable IDs remain.
6. Force ten refreshes of currently rendered cells.

Scroll positions are changed through the real AG Grid 36 `.ag-grid-viewport` DOM element; no Angular private state or test-only grid API exposure is used. Counts include pinned cells. Viewport selectors are deliberately version-specific and should be rechecked during an AG Grid upgrade.

## Rendered window

| Snapshot | Rendered rows | Rendered cells | Virtual columns including pinned | Row indices |
| --- | ---: | ---: | ---: | --- |
| Initial render | 27 | 297 | 11 | 0–26 |
| After vertical scroll | 37 | 407 | 11 | 490–526 |
| After horizontal scroll | 37 | 407 | 11 | 490–526 |
| Metadata update | 27 | 297 | 11 | 0–26 |
| Row replacement | 27 | 297 | 11 | 0–26 |

The initial DOM contains 297 cells rather than all 200,000 potential cells. Both scroll axes retained virtualization. A separate scenario increased the dataset to 5,000 rows and verified that fewer than 60 rows remained rendered.

## Timing

- Component construction to settled first render: **243.50 ms**.
- Metadata-only update, including the targeted forced refresh and frame settling: **63.70 ms**.
- Row replacement to settled render: **28.40 ms**.
- Ten forced rendered-cell refreshes: median **33.00 ms**, range **28.90–34.00 ms**.

Each duration includes at least two animation frames and any remaining AG Grid animation-frame work. The metadata operation includes two settling periods. These are end-to-settled-render observations, not CPU-only durations. Initial time excludes lazy-chunk download/evaluation before component construction. Post-scroll manual snapshot timing measures snapshot settling, not scrolling throughput; no FPS claim is made.

This is one reproducible development-run observation, not a statistical performance target or production-load claim. Repeat the same sequence and environment before comparing later renderer implementations. Telemetry updates occur only on explicit actions, not continuously during scrolling.

## Verification

- `npm run build`: passed. Initial bundle 251.31 kB raw; lazy grid feature approximately 2.87 MB raw with the full Enterprise module registration. The large lazy feature is recorded as part of this baseline, not hidden by increasing initial bundle budgets.
- `npm run test:unit`: 11 tests passed. Fixtures cover deterministic data, IDs, zero/null cases, metadata-only changes, independent replacement, and row-count bounds.
- `npm run test:e2e`: 3 tests passed. Both virtualization axes, metadata/value independence, configurable row count, client/server mode selection without requests, and automated accessibility checks passed.
- No browser page errors occurred in the baseline scenario. The axe scan reported no violations in the tested viewport/state; this is not a blanket manual accessibility certification.
- Screenshot inspected for layout and readable grid/measurement controls.

Production builds needed execution outside the tool sandbox because the sandboxed build worker aborted without diagnostics. The build succeeded without code workarounds or changing the configured budgets.

## Reproduce

```sh
npm ci
npm run build
npm run test:unit
npm run test:e2e
# Or just regenerate the performance observation:
npm run baseline
```

Browser tests use installed Chrome by default. See the README for the Playwright Chromium alternative and optional local license configuration. Step 1 introduces no license key, real backend endpoint, or save service. Client/server selection is a future-mode setting only.

The reviewed raw measurement is [baselines/step-1.json](baselines/step-1.json). New runs write ignored `artifacts/baseline-step-1.json` and `artifacts/baseline-step-1.png`; preserve the reviewed baseline when comparing subsequent steps.
