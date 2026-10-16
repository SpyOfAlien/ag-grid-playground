# Step 4 renderer comparison

Recorded 2026-10-03 21:17 Asia/Ho_Chi_Minh. This increment adds TextCell, NumberCell, attribute directives, and a feature-owned edit-action preview to the ordinary grid. The reviewed [step 1 baseline](baseline-step-1.md) is unchanged.

## Environment and sequence

The browser, hardware, viewport, row model, fixture size, column widths, row height/buffer, and interaction sequence match step 1: headless Chrome 154.0.8037.93, Apple M2 with 16 GiB RAM, 1440 × 1000 viewport, 1,000 rows, 200 columns, 32px rows, 10-row buffer, and two pinned columns. These observations use the Angular development server without throttling. Production build is verified separately.

All visible cells now use custom renderers selected through cellRendererSelector. Text and number cells use their own params models. Review demonstrates the marker/content/pen layout and permission guard without opening an editor or submitting a mutation. Every number displays a configured row-dependent unit when it has a finite value.

The measurement scrolls vertically to 16,000px, horizontally to the last metric, returns to the origin, changes metadata, replaces values, and forces ten rendered-cell refreshes. Metadata refresh now forces all rendered cells because units, markers, permissions, and content states can depend on metadata. The baseline forced only the review column.

## Observations

| Observation | Step 1 | Step 4 |
| --- | ---: | ---: |
| Initial rendered rows / cells / virtual columns | 27 / 297 / 11 | 27 / 297 / 11 |
| Scrolled rendered rows / cells / virtual columns | 37 / 407 / 11 | 37 / 407 / 11 |
| Initial settled render | 243.50ms | 213.00ms |
| Metadata update | 63.70ms | 58.60ms |
| Row replacement | 28.40ms | 27.10ms |
| Ten forced refreshes, median | 33.00ms | 33.10ms |
| Ten forced refreshes, range | 28.90–34.00ms | 28.10–33.30ms |

The initial rendered window contains 297 Angular renderer hosts and 594 direct child elements. The maximum per host is three children; no renderer contains another renderer. These counts exclude AG Grid's elements and Angular comment nodes. Plain text cells have one content span; decorated scalar cells have marker/content spans; the review preview adds one button. CSS draws symbols without icon components or nested elements. The 562 configured tooltip targets use native title attributes; no tooltip overlay elements are mounted.

This is a single observation per stage. Initial timing varies with run conditions and does not establish a speedup. Forced refresh durations include at least two animation frames, so they do not establish CPU cost or FPS. The measurements show retained virtualization and similar settled-refresh duration in this sequence. Larger datasets, editor overlays, and final mixed-cell comparisons remain later checks.

## Verification

- Production build passed: initial bundle 254.42kB raw and lazy grid feature approximately 2.88MB raw.
- 71 unit tests and compile-only contract/runtime-param checks passed.
- Six browser checks passed, including virtualization, 5,000-row mode, no mutation requests, native tooltip attributes, reserved padding/offsets, resizing/ellipsis, zero/empty units, and an axe scan with no violations in the tested state.
- Metadata refresh retains the actual NumberCell host and content span while changing the unit, marker, tooltip, and permission.
- Hover reveals the pen without moving content. Its disabled reason remains available and denied activation never reaches the demo context callback.
- Screenshot inspected for layout and readable markers, values, units, and controls. No browser page errors occurred during the recorded sequence.

## Reproduce

```sh
npm run test:unit
npm run test:types
npm run build
npm run test:e2e
# Measurement sequence only:
npm run baseline
```

Step 4 runs wrote ignored artifacts/baseline-step-4.json and artifacts/baseline-step-4.png. The runner now writes the current increment, using step-12 artifact names after final integration. The reviewed raw measurement is [baselines/step-4.json](baselines/step-4.json). The runner now measures the current increment; it does not recreate the historical step 1 source.
