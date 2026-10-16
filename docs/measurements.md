# Historical measurements

These reports preserve the observed code, workload, environment, dates, and test results of their recorded runs. Their architectural descriptions can name modules that no longer exist. Use the design and usage guides for current behavior. No old observations have been rewritten to describe the current implementation.

| Recorded date | Evidence                                                                        | Environment and workload                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-03    | [Ordinary-cell baseline](baseline-step-1.md), [JSON](baselines/step-1.json)     | Angular development server, headless Chrome, Apple M2/macOS, 1440 × 1000 viewport, 1,000 rows and 200 columns.                                |
| 2026-10-03    | [Scalar-renderer comparison](baseline-step-4.md), [JSON](baselines/step-4.json) | Same machine/browser/viewport, 1,000 rows and 200 columns, scalar text/number renderers.                                                      |
| 2026-10-04    | [Mixed-grid measurement](baseline-step-12.md)                                   | Three sequential development runs, same machine/viewport, 1,000 rows and 200 columns, mixed renderers/editors. Reports retain all JSON links. |
| 2026-10-04    | [Material editor results](material-editor-migration-results.md)                 | Material/CDK 21.2.14, development browser checks including a 390px narrow viewport, on-demand editor DOM and integration cleanup.             |

The reports describe frame-settled timings and live DOM. They do not establish production timing, FPS, other-machine guarantees, or detached-heap measurements. Newly generated files under artifacts are not automatically part of this reviewed archive.

[Current design](ag-grid-cell-kit-design.md) · [Usage](cell-kit-usage.md) · [Flows](cell-kit-flows.md)
