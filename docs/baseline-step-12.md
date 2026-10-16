# Final cell kit measurement

Recorded 2026-10-04, Asia/Ho_Chi_Minh. Three sequential runs compare the completed mixed grid with the [step 1 baseline](baseline-step-1.md) and [step 4 scalar renderer comparison](baseline-step-4.md). Historical measurements are preserved; their old source was not rerun.

## Environment and sequence

Headless Chrome 154.0.8037.93, Apple M2 with 16 GiB RAM, macOS/Darwin 24.6.0, 1440 × 1000 viewport, Angular development server, no CPU/network throttling. Dependencies match the earlier measurements: Angular 21.2.25, Material 21.2.14, AG Grid 36.2.0.

Each run starts with 1,000 rows, 200 columns, 32px row height, 10-row buffer, two pinned columns, and a client-side row model. The same sequence scrolls to 16,000px vertically, scrolls to the final metric horizontally, returns to the origin, changes metadata, replaces row values, and forces ten rendered-cell refreshes.

The initial viewport contains all six built-in renderer types, the review-action preview, and the feature composite. Final editable/control columns replace some old numeric columns; Details is 160px wide and the composite is 240px wide. These are a mixed-UI comparison, not identical scalar workloads. Step 1 forced only review metadata; steps 4 and 12 force rendered-row cells because units/markers/permissions can depend on metadata.

## Observations

Step 12 timings show the median and range across three runs, except refresh which aggregates all 30 samples. Earlier stages are single observations.

| Observation                                    |                  Step 1 |                  Step 4 |                    Step 12 |
| ---------------------------------------------- | ----------------------: | ----------------------: | -------------------------: |
| Initial rows / cells / virtual columns         |           27 / 297 / 11 |           27 / 297 / 11 |              27 / 297 / 11 |
| Scrolled rows / cells / virtual columns        |           37 / 407 / 11 |           37 / 407 / 11 |              37 / 407 / 11 |
| Initial settled render                         |                243.50ms |                213.00ms | 201.20ms (198.40–201.50ms) |
| Metadata update                                |                 63.70ms |                 58.60ms |    60.50ms (60.50–60.70ms) |
| Row replacement                                |                 28.40ms |                 27.10ms |    28.50ms (28.10–28.50ms) |
| Forced refresh, median/range                   | 33.00ms / 28.90–34.00ms | 33.10ms / 28.10–33.30ms |    33.10ms (24.30–33.90ms) |
| Renderer hosts at origin                       |           ordinary grid |                     297 |                        297 |
| Renderer direct child elements                 |           ordinary grid |                     594 |                        675 |
| Renderer descendant elements                   |           ordinary grid |                     594 |                        729 |
| Maximum direct children per renderer           |           ordinary grid |                       3 |                          3 |
| Nested renderer hosts                          |                    none |                       0 |                          0 |
| Mounted editor overlay panes before activation |                       0 |                       0 |                          0 |
| Native title targets at origin                 |            not recorded |                     562 |                        648 |

The final initial grid has 1795 live descendant elements including AG Grid's own elements. Renderer counts exclude comment nodes and CSS pseudo-elements. All three runs have the same initial DOM counts. The extra controls add 81 direct elements versus step 4; composite content contributes 54 nested child elements. Editors and dropdown options add no permanent views to resting cells.

Virtualization remains bounded in this sequence and in the separate 5,000-row functional check. Settled refresh durations remain near the frame floor. Initial render medians do not prove a speedup: these waits include two animation-frame callbacks and vary with scheduling, and the old stages have only one observation. Manual scroll snapshots measure capture settling after the scroll, not scroll latency or FPS. No CPU flame profile, throttled-device measurement, or production rendering benchmark was collected.

## Editor lifecycle

The integration check opens popover, dialog, dropdown, and composite numeric editors four times each, 16 presentations total. The first cycle warms each focus/virtualization path; later identical closed states have equal live DOM counts.

| Presentation | Open overlay descendants | Closed grid descendants | Closed rendered cells |
| ------------ | -----------------------: | ----------------------: | --------------------: |
| Popover      |                       17 |                    2005 |                   351 |
| Dialog       |                       20 |                    2009 |                   352 |
| Dropdown     |                       16 |                    2005 |                   351 |
| Composite    |                       17 |                    2005 |                   351 |

Different focus paths can change the virtual row/cell window, so closed counts are compared within each path rather than against an unrelated initial window. Every close releases grid inert state and leaves zero editor instances, overlay panes, backdrops, and focus-trap anchors. Navigation while a dropdown is open removes the presentation; returning creates an unlocked table. No browser page errors were recorded.

This measures live DOM and interaction cleanup, not detached heap objects or long-duration heap retention. Host tests cover listener/observer disposal, binding failure, owner destruction, and per-table isolation. Final checks also caught a hidden AG Grid scrollbar proxy that could escape the interaction lock. The lock now snapshots those viewports explicitly; a unit regression and three repeated browser runs cover both hosts with and without backdrops.

## Performance decisions and validation

Native title tooltips create no tooltip overlays. Symbols use CSS instead of icon component trees. Scalars retain their content on metadata refresh; the composite retains both controls and its amount. Category rules are pure computed state, and formatter construction uses a cache bounded at 128 configurations. The demo's blue-marker placeholder is cached per row/column identity and cleared with the table. The keyboard helper performs control lookup only on keyboard events and adds no per-cell DOM/listeners.

No new performance abstraction or speculative optimization was added. These observations justify retaining virtualization, small renderers, shared formatters, targeted table refreshes, and on-demand editors. A consuming application's heavy rule callbacks or external store may require a separate profile.

Production build passed with 289.17kB raw initial code/styles and an approximately 2.90MB raw lazy grid feature. These are whole demo bundles, not the standalone library size. The demo registers AllEnterpriseModule and includes API fixtures/measurement UI. Applications choose their own AG Grid modules. No package publishing or library bundle benchmark is implied.

The final suite passes 151 unit tests, compile-only examples with 24 expected rejection cases, and 42 browser checks. Tests cover mixed virtualization, pinned columns, metadata-only changes, row replacement/removal, units/zero/missing values, shared ellipsis styling, both presentations, client/server persistence, failure/retry, requests after closing, repeated cleanup, and accessibility scans. Pen actions are keyboard-focusable; Tab enters a custom cell control, focus reveals its pen, and Space opens the editor. Mouse behavior remains hover-driven. The final screenshot was inspected for layout, spacing, markers, values, and controls.

## Reproduce

```sh
npm ci
npm run build
npm run test:unit
npm run test:types
npm run test:e2e
npm run baseline -- --repeat-each=3
```

The measurement runner writes ignored `artifacts/baseline-step-12.json`, numbered run JSON files, and `artifacts/baseline-step-12.png`. The integration check writes `artifacts/integration-step-12.json`. Reviewed inputs are [run 1](baselines/step-12-run-1.json), [run 2](baselines/step-12-run-2.json), [run 3](baselines/step-12-run-3.json), and [lifecycle observations](baselines/step-12-integration.json).

The [usage guide](cell-kit-usage.md) describes public imports, integration contracts, and deferred application work. The baseline runner always measures current source; these saved files preserve the reviewed observations.
