# Angular cell kit

Composable cell renderers and editors for Angular 21, Angular Material 21, and AG Grid Enterprise 36.2.0. The kit is application source under `src/app/shared/grid-cells`, with a separate custom popover under `src/app/shared/popover`.

Cells combine optional marker, content, and edit action regions. Renderer-specific params configure independent display states, number formatting and units, permissions, and typed editors. Resting cells use native controls; on-demand editors use Material fields and actions. Editors save through explicit feature actions with typed EditCommand data. Features choose local transaction/mutation commits or server actions that return authoritative row sets.

## Guides

- [Design and type contracts](docs/ag-grid-cell-kit-design.md)
- [Open, save, and cleanup flows](docs/cell-kit-flows.md)
- [Integration and usage examples](docs/cell-kit-usage.md)
- [Grid integration and signals](docs/cell-kit-integration.md)
- [Editor host and lifetime](docs/editor-host.md)
- [Feature persistence and update strategies](docs/feature-persistence.md)

Import supported kit code from `src/app/shared/grid-cells/public-api.ts` and standalone floating UI from `src/app/shared/popover/public-api.ts`. Reusable editor presentation has its own entry point at `src/app/shared/grid-cells/editing/editor-host/public-api.ts`. Internal mounting and geometry helpers remain private.

## Integration

Display-only tables need renderer params, cell layout styles and column definitions. Configure native-control keyboard behavior with withCellKeyboardColumns; pass application default-column keyboard rules as its second argument when needed. Editing tables provide EditorHostService at their owning component and pass it through grid context. A generic editor receives initial value/config/save data; a complex editor defines its own form and calls feature actions directly.

The edit path is cell activation, editor presentation, then a feature persistence action that commits canonical state and updates the grid. EditCommand<T> carries cell identity, typed data and optional HTTP query params. The host controls dismissal/focus and owns no row update protocol.

Choose one grid synchronization path. Bind canonical rows to rowData for a simple replacement-based table, or let feature state own a connected grid for transaction/mutation commits. The [small HTTP table example](type-tests/docs/amount-table-example/amount-table-example.ts) and [connected client example](type-tests/docs/client-editing-example.ts) compile with their Angular templates. The kit uses native resting cell controls and creates Material editor content only when opened. Stable column params can read presentation signals inside category calculations. Angular updates dependent cell state directly; feature commits remain responsible for data/model and metadata refresh. No runtime grid integration directive is required.

## Run the demos

```sh
npm ci
npm start
```

Open [the cell editor showcase](http://localhost:4200/grid-demo), [the column grouping demo](http://localhost:4200/column-group-demo), or [the standalone popover demo](http://localhost:4200/popover-demo). Cell editing and column grouping use separate tables and routes. The application uses standalone components, lazy routes, strict templates, signals, and zoneless Angular.

The showcase is one table with 12 rows and ten columns. It includes text and number input popovers, a textarea dialog, a complex dialog with Save details and Save and approve actions, direct toggle/dropdown controls, and a composite toggle/number cell. Two display-only numeric columns show formatting, markers and disabled content. Hover to reveal pens; unreviewed rows demonstrate disabled editing. The last row has an empty composite amount to demonstrate omitted units.

Show units changes presentation through a signal without rebuilding columns or refreshing the grid. Choose Client for local transaction updates or Server for a local mock HTTP API returning recalculated datasets. The API response selector demonstrates success and failure. Reset demo restores the initial rows. Row and column virtualization remain enabled. The former benchmark and three-tab demo pages have been removed; historical performance reports remain archived.

Set `AG_GRID_LICENSE_KEY` to supply an Enterprise license. The prepare/start/build scripts generate ignored `public/runtime-config.js` without printing the key. Without a key, AG Grid uses evaluation mode. The project uses an ignored `.npm-cache` directory.

## Verify

```sh
npm run build
npm run test:unit
npm run test:types
npm run test:e2e
```

Type checks cover public contracts and the documentation's TypeScript and Angular template examples. Browser tests cover rendering, editors, persistence, cleanup, keyboard behavior, and automated accessibility checks. They use installed Google Chrome at a 1440 × 1000 viewport and start a development server on port 4200 if needed. To use Playwright Chromium:

```sh
npx playwright install chromium
PLAYWRIGHT_CHANNEL=chromium npm run test:e2e
```

Generated screenshots and measurements go into ignored `artifacts` and `test-results` directories. Historical performance evidence is indexed in [the measurement archive](docs/measurements.md). Those measurements describe their recorded environments and workloads; they are not current performance guarantees.
