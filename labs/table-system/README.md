# Independent table system lab

This workspace boots the new table system independently. The current application, grid cells, editor host, routes, demos, tests and package scripts are unchanged. The only existing UI dependency is the shared popover, consumed through the new presentation adapter.

Run these commands from this directory. They use the repository's installed Angular 21, AG Grid 36, Vitest, Playwright and AXE dependencies. No install step is required.

```sh
../../node_modules/.bin/ng serve --host 127.0.0.1
# Open http://127.0.0.1:4301
../../node_modules/.bin/ng build
../../node_modules/.bin/tsc -p tsconfig.types.json
../../node_modules/.bin/tsc -p tsconfig.app.json --noEmit
../../node_modules/.bin/vitest run --config vitest.config.ts
../../node_modules/.bin/ng test --watch=false
../../node_modules/.bin/playwright test --config playwright.config.ts --grep-invert 'records repeatable'
../../node_modules/.bin/playwright test --config playwright.config.ts browser/performance.spec.ts --workers=1
python3 audit.py
```

The browser configuration uses installed Google Chrome, starts its own local development server when needed, and keeps results inside this workspace. The build writes `dist/browser`. This environment required normal process permissions to run Angular builds and Chrome because sandboxed Angular builds aborted. No dependencies were downloaded.

The lab has 1,000 independently created rows. Item 0 has a zero amount and annotation, item 1 has a missing amount, item 2 demonstrates decimal normalization, and item 3 has independent amount/category restrictions while review remains allowed. The duplicated review controls and custom composite share a business target. "Slow saves" makes virtualization during a pending operation easy to inspect. "Fail next save" exercises deliberate retry. The toolbar also demonstrates dialogs, dependent updates, filtering, sorting, grouping, replacement, removal and a disconnected grid.

Grouping uses the installed AG Grid Enterprise RowGroupingModule. The lab runs with its trial watermark. A production deployment with grouping requires an appropriate AG Grid license.

Use `?baseline=1` to render the two-column display configuration. Historical Phase 1 timings were not recorded. `performance-results.json` therefore compares a reconstructed display baseline with the current complete system, not historical bootstrap or bundle performance. Its recorded environment, fixture size, viewport, visible/rendered cell counts and interaction sequence make the measurement repeatable. Performance checks run separately to avoid other test workers distorting timings.

[Architecture and integration](ARCHITECTURE.md) describes ownership, ordinary usage and custom content. [Progress](PROGRESS.md) records phase acceptance. `initial-state.json` captures the starting file hashes and Git status. `audit.py` compares every pre-existing file and rejects prohibited imports. It reports npm cache changes separately from application and user files.

The relevant unchanged popover regression command, run from the repository root, is:

```sh
npm run test:unit -- --include='src/app/shared/popover/**/*.spec.ts'
```
