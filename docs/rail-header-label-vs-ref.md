# Rail header label vs the ref

How `/rail-header-label` (`src/app/features/rail-header-label/`) differs from the signal grid
code in `ref/equip/collapsed/` (the root files; `ref/equip/collapsed/split/` is not used). Each
section puts the ref code next to the new code and says why it changed. The full diffs are in the
appendix.

**The idea is unchanged:** the rail column's header component draws the collapsed group's name
and lets it run down the rail. What changed is how the rail reaches the bottom of the table and
how it stays under the pinned columns when the table scrolls sideways: the ref measures and clips
in TypeScript, per rail, on every scroll; the new code does both in CSS.

## File map

| Ref (`ref/equip/collapsed/`)                        | New (`rail-header-label/`)            | Relation                                                       |
| --------------------------------------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `collapsed-header.component.ts` (+ missing `.html`) | `rail-label-header.ts`                | Rewritten: same role, no measuring or listening                |
| `signal-column-defs.ts`                             | `columns/build-signal-column-defs.ts` | Same structure; rail header swapped, demo scope                |
| `signal-grid.component.ts` (+ missing `.html`)      | `rail-header-label.ts`                | Same grid setup, trimmed to what the rails touch               |
| `signal-structure-tree.ts`                          | `signal-structure-tree.ts`            | Same logic (type-only import, doc comment)                     |
| `ag-grid-theme.css` (rail rules)                    | `rail-header-label-rails.css`         | Rail rules replaced; adds the pinned-edge clip                 |
| —                                                   | `clip-header-at-pinned-edge.ts`       | New: fallback listener, browsers without scroll timelines only |
| —                                                   | `rail-header-label.css`               | New: page and Figma styling (tokens, toolbar, group headers)   |
| `@domain/signal/signal.model`                       | `signal.model.ts`                     | Trimmed copy: only what the demo needs                         |
| `SignalApi` + `createSignalGridDatasource`          | `signal-data.ts`                      | Mock data and a server-side datasource                         |
| —                                                   | `renderers/filter-row-cell.ts`        | New: the Figma filter row                                      |

## 1. The rail header component

### Ref: `collapsed-header.component.ts`

```ts
const LAYOUT_EVENTS = ['columnGroupOpened', 'columnResized', 'newColumnsLoaded'] as const;

@Component({
  selector: 'app-collapsed-group-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex h-full w-full flex-col items-center gap-2 bg-[var(--group-bg)] py-1.5 shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)]',
  },
  templateUrl: './collapsed-header.component.html',
})
export class CollapsedGroupHeader implements IHeaderAngularComp, OnDestroy {
  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
  protected readonly label = signal('');
  protected readonly changeCount = signal(0);
  private api?: IHeaderParams<SignalRow>['api'];
  private viewport: HTMLElement | null = null;
  private frame = 0;
  private contentLeft = 0;
  private pinnedRight = 0;

  agInit(params) {
    /* listens to LAYOUT_EVENTS, measures, refresh(params) */
  }
  refresh(params) {
    /* label, changeCount */
  }

  private measure(): void {
    // finds .ag-grid-viewport, (re)attaches a 'scroll' listener and a ResizeObserver to it,
    // reads the pinned columns' right edge and its own left edge,
    // sets host.style.height = viewport.clientHeight - its top (px), then applyClip()
  }
  private readonly onLayoutChange = () => {
    /* measure() next frame */
  };
  private readonly onScroll = () => this.applyClip();
  private readonly resizeObserver = new ResizeObserver(() => this.onLayoutChange());

  private applyClip(): void {
    const overlap = this.pinnedRight - (this.contentLeft - (this.viewport?.scrollLeft ?? 0));
    this.host.style.clipPath = overlap > 0 ? `inset(-9999px 0 -9999px ${overlap}px)` : '';
  }

  ngOnDestroy() {
    /* cancel frame, disconnect observer, remove grid and scroll listeners */
  }
}
```

### New: `rail-label-header.ts`

```ts
@Component({
  selector: 'app-rail-label-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex h-[calc(100%+100vh)] w-full flex-col items-center gap-2 overflow-hidden pt-2 ' +
      'bg-(--group-bg) shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)]',
    '[attr.title]': 'label()',
  },
  template: `
    <span
      class="h-5 min-w-5 shrink-0 rounded bg-(--signal-badge-bg) px-1 text-center text-xs leading-5 font-semibold text-(--signal-badge-fg)"
      [class.invisible]="changeCount() === 0"
      aria-hidden="true"
      >{{ changeCount() }}</span
    >
    <span
      class="shrink-0 rotate-180 text-sm leading-5 font-medium whitespace-nowrap [writing-mode:vertical-rl]"
      >{{ label() }}</span
    >
  `,
})
export class RailLabelHeader implements IHeaderAngularComp {
  protected readonly label = signal('');
  protected readonly changeCount = signal(0);

  agInit(params: RailLabelHeaderParams): void {
    this.refresh(params);
  }

  refresh(params: RailLabelHeaderParams): boolean {
    this.label.set(params.displayName);
    this.changeCount.set(params.changeCount);
    return true;
  }
}
```

### What changed, piece by piece

| Ref                                                                                                                                  | New                                                                                                                | Why                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `host.style.height = viewport.clientHeight - top` (px, from `measure()`)                                                             | `h-[calc(100%+100vh)]` + `overflow-hidden`; the grid cuts it at the table's bottom (`overflow-y: clip`, section 4) | Reaching the bottom needs no measuring: the rail is simply taller than any table and cut to it         |
| `applyClip()`: `clip-path: inset(... overlap)` written on the host on every scroll                                                   | Removed; one `clip-path` on the header's column row in CSS, moved by a scroll timeline (section 4)                 | One clip for all rails, updated by the browser in step with the scrolling instead of a script per rail |
| `scroll` listener + `ResizeObserver` on the viewport, `columnGroupOpened` / `columnResized` / `newColumnsLoaded` listeners, per rail | None                                                                                                               | Nothing is measured, so nothing listens                                                                |
| `OnDestroy` cleaning all of the above                                                                                                | No lifecycle beyond `agInit` / `refresh`                                                                           | AG Grid rebuilds header components on every `refreshHeader()`; now that costs nothing                  |
| `templateUrl` (the `.html` isn't in `ref/`)                                                                                          | Inline template: badge, then name                                                                                  | Small component; the template is two spans                                                             |
| Count always shown (as far as the `.ts` shows)                                                                                       | `[class.invisible]` at 0: hidden, space kept                                                                       | Names start at the same height on every rail                                                           |
| `py-1.5`                                                                                                                             | `pt-2`                                                                                                             | Figma spacing; no bottom padding since the host runs past the table                                    |
| `bg-[var(--group-bg)]`                                                                                                               | `bg-(--group-bg)`                                                                                                  | The same, in Tailwind v4's shorthand                                                                   |
| —                                                                                                                                    | `[attr.title]` with the full name                                                                                  | Tooltip for names cut off at the bottom                                                                |
| `IHeaderParams<SignalRow>` + `changeCount`                                                                                           | `RailLabelHeaderParams`, the same shape                                                                            | Renamed with the component                                                                             |

Kept: `IHeaderAngularComp`, `OnPush`, the `label` / `changeCount` signals, `agInit` → `refresh`,
`params.displayName`, host classes for the layout, the `--group-bg` / `--group-divider` colours,
the inset divider shadows.

## 2. Column defs

`signal-column-defs.ts` → `columns/build-signal-column-defs.ts`

### Kept

- `buildSignalColumnDefs(groups, columns, options)`: No# column, Revision column, then the
  structure tree turned into col defs by `toColDefs()`.
- `ROW_NO_COL_ID`, `REVISION_COL_ID`, `RAIL_COL_ID`, `isRailColId()`.
- `toColDefs()`: leaves become leaf col defs, groups become group col defs, empty groups are
  dropped.
- Group col def: `groupId`, `headerName`, `openByDefault: true`, `marryChildren: true`, the rail
  as first child, every real child `columnGroupShow: 'open'`.
- Rail col def: `colId: <group>__rail`, `headerName: group.name`, `columnGroupShow: 'closed'`,
  fixed width (min = max), not resizable / sortable / filterable / navigable / movable,
  `wrapHeaderText: false`, `autoHeaderHeight: false`, `headerClass: signal-rail <level>`,
  `cellClass: signal-rail-cell <level>`, `headerComponentParams: { changeCount }`,
  `valueGetter: () => ''`.

### Group col def

```ts
// ref
const baseHeaderClass = depth === 0 ? 'signal-group-root' : 'signal-group-nested';
const levelClass = `signal-level-${Math.min(depth, MAX_GROUP_LEVEL)}`; // MAX_GROUP_LEVEL = 5
const groupHeaderClass = `${baseHeaderClass} signal-group ${levelClass}`;
const rail = railColDef(group, levelClass, options.changeCountFor?.(group.code) ?? 0);
const def: ColGroupDef<SignalRow> = {
  groupId: group.code,
  headerName: group.name,
  headerClass: groupHeaderClass,
  openByDefault: true,
  marryChildren: true,
  children: [rail, ...children.map((child) => ({ ...child, columnGroupShow: 'open' as const }))],
};
if (options.trackingEnabled) { /* rail replaced by a __changes_<group> column, badge per row */ }
if (/* the group is being renamed */) { /* PendingColumnHeaderComponent as headerGroupComponent */ }
return def;
```

```ts
// new
const levelClass = (depth: number) => (depth === 0 ? 'signal-level-outer' : 'signal-level-inner');

const level = levelClass(depth);
return {
  groupId: group.code,
  headerName: group.name,
  headerClass: `signal-group ${level}`,
  openByDefault: true,
  marryChildren: true,
  children: [
    railColDef(group, level, options),
    ...children.map((child) => ({ ...child, columnGroupShow: 'open' as const })),
  ],
};
```

- **Levels:** `signal-level-0` … `signal-level-5` (three palettes in the theme) → two classes,
  `signal-level-outer` (depth 0) and `signal-level-inner` (every deeper level), as in Figma.
- **`signal-group-root` / `signal-group-nested`:** dropped; nothing in the demo's CSS used them.
- **Change-tracking rail (`__changes_<group>`) and the group rename editor:** not in the demo.

### Rail col def

```ts
// ref
function railColDef(group, levelClass, changeCount): ColDef<SignalRow> {
  return {
    colId: `${group.code}${RAIL_COL_ID}`,
    headerName: group.name,
    columnGroupShow: 'closed',
    width: 38,
    minWidth: 38,
    maxWidth: 38,
    resizable: false,
    sortable: false,
    filter: false,
    floatingFilter: false,
    suppressNavigable: true,
    suppressMovable: true,
    wrapHeaderText: false,
    autoHeaderHeight: false,
    headerClass: `signal-rail ${levelClass}`,
    cellClass: `signal-rail-cell ${levelClass}`,
    headerComponent: CollapsedGroupHeader,
    headerComponentParams: { changeCount },
    valueGetter: () => '',
  };
}
```

```ts
// new
function railColDef(group, level, { changeCountFor }): ColDef<SignalRow> {
  return {
    colId: `${group.code}${RAIL_COL_ID}`,
    headerName: group.name,
    columnGroupShow: 'closed',
    width: RAIL_WIDTH,
    minWidth: RAIL_WIDTH,
    maxWidth: RAIL_WIDTH, // RAIL_WIDTH = 48
    flex: 0,
    resizable: false,
    sortable: false,
    filter: false,
    floatingFilter: false,
    suppressNavigable: true,
    suppressMovable: true,
    wrapHeaderText: false,
    autoHeaderHeight: false,
    headerClass: `signal-rail ${level}`,
    cellClass: `signal-rail-cell ${level}`,
    headerComponent: RailLabelHeader,
    headerComponentParams: { changeCount: changeCountFor?.(group.code) ?? 0 },
    valueGetter: () => '',
  };
}
```

- **Width:** 38px → 48px (Figma), as a constant.
- **`flex: 0`:** added. The demo's default col def has `flex: 1`, which would otherwise try to
  widen the rail (held back only by `maxWidth`).
- **Header component:** `CollapsedGroupHeader` → `RailLabelHeader`.
- **`changeCount`:** computed inside instead of passed in; same value.

### Leaf, No# and Revision col defs

|                       | Ref                                                                                       | New                                                                 |
| --------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Leaf value            | `field: data.<code>`, or `calculatedExpression` for formula columns                       | `field: data.<code>`                                                |
| Leaf editing          | `editable`, `valueParser`, `valueFormatter`, `cellDataType: false`                        | none (read-only demo)                                               |
| Leaf classes          | locked / input / removed classes, `cell-modified` rule, change renderer in validator view | none                                                                |
| Leaf filter           | (in the grid's default col def)                                                           | `agTextColumnFilter` + `FilterRowCell` (Figma filter row)           |
| Pending column header | `PendingColumnHeaderComponent` while a column is named                                    | none                                                                |
| No#                   | 64px, pinned left, `cell-row-index`                                                       | 48px (Figma), pinned left, `lockPinned`, `flex: 0`, `filter: false` |
| Revision              | 130px, `cell-revision`, `cell-modified` rule, optional                                    | 110px, filter-row cell, always shown                                |

## 3. The grid

`signal-grid.component.ts` → `rail-header-label.ts`. The ref's `.html` isn't in `ref/`, so grid
options are compared with what the TypeScript binds.

### Kept

```ts
// both
rowModelType="serverSide"            // ref: SIGNAL_GRID_MODULES, SIGNAL_GRID_BLOCK_SIZE
[serverSideDatasource]="datasource"
[getRowId]="getRowId"                // params.data.signalId
[columnDefs]="columnDefs"
[defaultColDef]="defaultColDef"
[icons]="icons"                      // open group: chevron right, collapsed: chevron down

protected onColumnGroupOpened(event: ColumnGroupOpenedEvent<SignalRow>) {
  event.api.refreshHeader();         // ref also syncs parent groups and expand/collapse-all state
}
```

```ts
// ref defaultColDef                  // new defaultColDef
minWidth: 120,                        minWidth: 140,
flex: 1,                              flex: 1,
resizable: true,                      resizable: true,
sortable: false,                      sortable: false,
wrapHeaderText: true,                 wrapHeaderText: true,
autoHeaderHeight: true,               autoHeaderHeight: true,
suppressHeaderMenuButton: true,       suppressHeaderMenuButton: true,
                                      floatingFilter: !filtersHidden(),
```

### Added

```ts
[hidePaddedHeaderRows] = 'true';
```

With groups of different depths, AG Grid pads shallower columns with empty group cells. When
groups are collapsed, whole header rows end up holding only padding; AG Grid still outputs them as
`role="row"` with no cells, which fails axe (`aria-required-children`) and tells screen readers
the table has rows it doesn't have. This removes them. No visual or performance effect.

```ts
// onGridReady
const grid = this.host.querySelector<HTMLElement>('.rail-header-labels');
if (grid) clipHeaderAtPinnedEdge(grid, this.destroyRef);
```

Only does something in browsers without scroll-driven animations (section 4).

```ts
// theme
protected readonly theme = themeQuartz.withParams({ fontFamily: 'Inter, sans-serif', fontSize: 14, … });
```

The ref uses the legacy `ag-grid-theme.css` (`.ag-theme-quartz` with PrimeNG variables); the demo
uses AG Grid's Theming API with the Figma values.

### Not in the demo

Mode / edit mode and row heights (40 / 60), cell edits and `cellChange`, add / remove / restore
rows and columns, the pending column and group header editors, context menu, toolbar component,
full screen, changes summary (row hiding, `navigateToNextCell` / `tabToNextCell`), formulas,
validator view, removed rows and columns, toast, `SignalApi`. None of these touch the rails.

## 4. CSS

`ag-grid-theme.css` (rail rules) → `rail-header-label-rails.css`

### Ref

```css
.ag-header-cell.signal-rail {
  --ag-header-cell-hover-background-color: var(--group-bg);
  background: var(--group-bg);
  overflow: visible;
  padding: 0;
  border-width: 0;

  &::before {
    display: none;
  }

  .ag-header-cell-comp-wrapper {
    width: 100%;
    height: 100%;
    max-height: none;
    align-items: flex-start;
  }
}

.ag-cell.signal-rail-cell {
  background: var(--group-bg);
  border: 0;
  box-shadow:
    inset 1px 0 0 var(--group-divider),
    inset -1px 0 0 var(--group-divider),
    0 1px 0 var(--group-bg);
}

.ag-header-row.ag-header-row-column .ag-header-cell.signal-rail {
  border-top-width: 0;
}
```

### New

```css
.rail-header-labels {
  .ag-header-cell.signal-rail {
    --ag-header-cell-hover-background-color: var(--group-bg);
    overflow: visible;
    padding: 0;
    background: var(--group-bg);

    &::before,
    &::after {
      display: none;
    }

    .ag-header-cell-comp-wrapper {
      width: 100%;
      height: 100%;
      max-height: none;
      align-items: flex-start;
      overflow: visible;
    }
  }

  .ag-header-row-column {
    z-index: 3;
  }

  .ag-header-row :is(.ag-grid-pinned-left-cells, .ag-grid-pinned-right-cells) {
    z-index: 4;
  }

  .ag-cell.signal-rail-cell {
    border: 0;
    background: var(--group-bg);
  }

  .ag-grid-scrollable-area {
    overflow-y: clip;
  }

  .ag-header-row-column > .ag-grid-scrolling-cells {
    clip-path: inset(-100vh -100vh -100vh var(--rail-header-scroll-left, 0px));
  }

  @supports (animation-timeline: scroll()) {
    .ag-grid-viewport {
      scroll-timeline: --rail-header-x inline;
    }

    .ag-header-row-column > .ag-grid-scrolling-cells {
      animation: rail-header-pinned-edge linear both;
      animation-timeline: --rail-header-x;
      animation-range: 0px 100000px;
    }
  }
}

@keyframes rail-header-pinned-edge {
  from {
    clip-path: inset(-100vh -100vh -100vh 0px);
  }
  to {
    clip-path: inset(-100vh -100vh -100vh 100000px);
  }
}
```

### What changed

| Ref                                                                                | New                                                                              | Why                                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rail header cell: colour, `overflow: visible`, no padding, no `::before`           | Same, plus no `::after` and `overflow: visible` on the comp wrapper              | `::after` is the column separator, which showed as a light line between rails; the wrapper must let the rail out too                                                                                                 |
| `border-width: 0` on the rail header cell; `border-top-width: 0` in the column row | Dropped                                                                          | The demo's Theming API theme draws no border there. Under the ref's legacy theme, keep them: it gives header cells below the first row a top border that would cross the rail                                        |
| —                                                                                  | `.ag-header-row-column { z-index: 3 }`                                           | The rail runs from the column row down over the filter row, so that row goes on top                                                                                                                                  |
| —                                                                                  | Header rows' pinned cells `z-index: 4`                                           | …and the pinned header cells go over it, in every header row the rail spans                                                                                                                                          |
| Rail body cell: colour, divider shadows, `0 1px 0` seam cover                      | Colour only, `border: 0`                                                         | The rail header's overflow covers the body cells now; they only need colour in case                                                                                                                                  |
| —                                                                                  | `.ag-grid-scrollable-area { overflow-y: clip }`                                  | The rail is 100vh taller than its cell; this stops it at the table's bottom without adding scroll height (`clip`, unlike `hidden`, keeps the sticky header working)                                                  |
| Per rail, in TypeScript: `clip-path` from scroll offset and measured edges         | One `clip-path` on the header's column row, left edge = horizontal scroll offset | Below the header the rails would paint over the pinned body cells (AG Grid paints the whole header above the rows). In that row's own coordinates the pinned edge is exactly `scrollLeft`, so no measuring is needed |
| —                                                                                  | `scroll-timeline` + `animation-range: 0px 100000px`                              | The browser moves that edge with the scroll itself, with no script; over a fixed range, so at any offset the edge equals the offset, whatever the table's width                                                      |
| —                                                                                  | `--rail-header-scroll-left`                                                      | Fallback value, written by `clipHeaderAtPinnedEdge()` where scroll timelines aren't supported                                                                                                                        |

Not changed: the level colours (`--group-bg`, `--group-divider`, `color`) still come from the
level classes, defined in the page CSS (`rail-header-label.css`) instead of `ag-grid-theme.css`.

## 5. Structure tree

`signal-structure-tree.ts`: same function, same logic. Only `import` → `import type` and a doc
comment (see the appendix).

## 6. New files with no ref counterpart

- **`clip-header-at-pinned-edge.ts`**: returns at once where `animation-timeline: scroll()` is
  supported. Elsewhere, one passive `scroll` listener on `.ag-grid-viewport` writes
  `--rail-header-scroll-left` on the grid; cleaned up with the page. This is the ref's per-rail
  listener reduced to one for the whole header, used only as a fallback.
- **`rail-header-label.css`**: the page (toolbar, Figma tokens), the group header look (level
  colours, chevrons, collapsed group showing only its chevron), column header alignment, row lines
  stopping at the rails.
- **`signal-data.ts`**: mock groups, columns and rows, and a server-side datasource that filters
  and sorts like the backend, in place of `SignalApi`.
- **`signal.model.ts`**: `SignalGroup`, `SignalColumn`, `SignalRow`, `SignalStructureNode`, trimmed
  to what the demo uses.
- **`renderers/filter-row-cell.ts`**: the Figma filter row (search, select, filter and sort
  buttons) driving AG Grid's text filter.

## Known limits

- **Sideways scrolling:** the clip is updated by the browser. If a browser recomputes `clip-path`
  on the main thread while the scroll itself runs on the compositor, a fast sideways flick could
  show the rail over No# for one frame. Not observed; headless tests can't capture it.
- **Fallback browsers** (no scroll timelines): the listener can trail the scrolling by a frame.
- Vertical scrolling has no such risk: the header, and the rail in it, is sticky.

## Appendix: full diffs

<details>
<summary>signal-structure-tree.ts</summary>

```diff
--- ref/signal-structure-tree.ts
+++ rail-header-label/signal-structure-tree.ts
@@ -1,10 +1,15 @@
-import { SignalColumn, SignalGroup, SignalStructureNode } from './signal.model';
+import type { SignalColumn, SignalGroup, SignalStructureNode } from './signal.model';

 interface TreeEntry {
   orderNo: number;
   toNode: (depth: number) => SignalStructureNode;
 }

+/**
+ * Nests columns under their groups and groups under their parents, sorting siblings by
+ * orderNo. An unknown groupCode or parentCode puts the item at the top level. Groups in a
+ * parent cycle (or their own parent) are never reached from the top and are left out.
+ */
 export function buildSignalStructureTree(
   groups: SignalGroup[],
   columns: SignalColumn[],
```

</details>

<details>
<summary>signal-column-defs.ts → columns/build-signal-column-defs.ts</summary>

```diff
--- ref/signal-column-defs.ts
+++ rail-header-label/columns/build-signal-column-defs.ts
@@ -1,63 +1,24 @@
-import {
-  CellClassParams,
-  ColDef,
-  ColGroupDef,
-  EditableCallbackParams,
-  ICellRendererParams,
-  ValueFormatterParams,
-  ValueParserParams,
-} from 'ag-grid-community';
-import { TabPermission } from '@domain/device-tab/tab-permission.enum';
-import { buildSignalStructureTree } from '../../signal-structure-tree';
-import { toCellText, toExcelCellValue } from '../excel-cell-value';
-import { isPendingColumnCode } from '../../pending-column-code';
-import { PendingColumnHeaderComponent } from './pending-column-header.component';
-import {
-  hasModifications,
-  isModifiedCell,
-  type ModificationContext,
-} from '../../signal-modifications';
-import { SignalChangeRenderer } from './signal-change-renderer';
-import {
-  SignalColumn,
-  SignalGroup,
-  SignalHeaderKind,
-  SignalRow,
-  SignalStructureNode,
-} from '../../signal.model';
-import { CollapsedGroupHeader } from '../renderers/headers/collapsed-header.component';
+import type { ColDef, ColGroupDef } from 'ag-grid-community';
+import { buildSignalStructureTree } from '../signal-structure-tree';
+import type { SignalColumn, SignalGroup, SignalRow, SignalStructureNode } from '../signal.model';
+import { FilterRowCell, type FilterRowCellParams } from '../renderers/filter-row-cell';
+import { RailLabelHeader } from '../rail-label-header';

 export const ROW_NO_COL_ID = '__rowNo';
 export const REVISION_COL_ID = '__revision';
 export const RAIL_COL_ID = '__rail';
-export const CHANGED_COL_ID = '__changes';

 export const isRailColId = (colId: string): boolean => colId.endsWith(RAIL_COL_ID);
-export const isChangedColId = (colId: string): boolean => colId.startsWith(CHANGED_COL_ID);

-export const MAX_GROUP_LEVEL = 5;
+/** Width of a collapsed group's rail. */
+export const RAIL_WIDTH = 48;

 type SignalColDef = ColDef<SignalRow> | ColGroupDef<SignalRow>;

-export interface PendingColumnHeaderOptions {
-  onNameChange: (code: string, name: string) => void;
-  validateName: (code: string, name: string) => Promise<string | null | undefined>;
-  onGroupNameChange?: (code: string, name: string) => void;
-  validateGroupName?: (code: string, name: string) => Promise<string | null | undefined>;
-  onInvalidChange?: (error: string | null) => void;
-  editingCode: string | null;
-  editingKind?: SignalHeaderKind | null;
-}
-
 export interface SignalColumnDefOptions {
-  editMode?: boolean;
-  isRowRemoved?: (row: SignalRow | undefined) => boolean;
-  isColumnRemoved?: (columnCode: string) => boolean;
-  showRevision?: boolean;
-  pendingColumn?: PendingColumnHeaderOptions;
   changeCountFor?: (groupCode: string) => number;
-  trackingEnabled?: boolean;
-  validatorView?: boolean;
+  /** The values offered by a select filter (columns with selectFilter). */
+  selectOptionsFor?: (columnCode: string) => readonly string[];
 }

 export function buildSignalColumnDefs(
@@ -67,7 +28,7 @@
 ): SignalColDef[] {
   return [
     rowNoColDef(),
-    ...(options.showRevision === false ? [] : [revisionColDef(options)]),
+    revisionColDef(),
     ...toColDefs(buildSignalStructureTree(groups, columns), options),
   ];
 }
@@ -82,212 +43,67 @@
   });
 }

+/** The outermost groups are dark; every level below shares the light colours. */
+const levelClass = (depth: number) => (depth === 0 ? 'signal-level-outer' : 'signal-level-inner');
+
 function toGroupColDef(
   group: SignalGroup,
   depth: number,
   children: SignalColDef[],
   options: SignalColumnDefOptions,
 ): ColGroupDef<SignalRow> {
-  const baseHeaderClass = depth === 0 ? 'signal-group-root' : 'signal-group-nested';
-  const levelClass = `signal-level-${Math.min(depth, MAX_GROUP_LEVEL)}`;
-  const groupHeaderClass = `${baseHeaderClass} signal-group ${levelClass}`;
-
-  const rail = railColDef(group, levelClass, options.changeCountFor?.(group.code) ?? 0);
-  const def: ColGroupDef<SignalRow> = {
+  const level = levelClass(depth);
+  return {
     groupId: group.code,
     headerName: group.name,
-    headerClass: groupHeaderClass,
+    headerClass: `signal-group ${level}`,
     openByDefault: true,
     marryChildren: true,
-    children: [rail, ...children.map((child) => ({ ...child, columnGroupShow: 'open' as const }))],
-  };
-  if (options.trackingEnabled) {
-    const context: ModificationContext = { trackingEnabled: true };
-    const codes = descendantCodes(children);
-    def.children = [
-      {
-        ...rail,
-        colId: `__changes_${group.code}`,
-        editable: false,
-        cellDataType: false,
-        valueGetter: (params) =>
-          codes.filter((code) => isModifiedCell(params.data, code, context)).length,
-        cellRenderer: (params: ICellRendererParams<SignalRow, number>) => {
-          const badge = document.createElement('span');
-          if (params.value && params.value > 0) {
-            badge.className = 'signal-change-badge';
-            badge.textContent = String(params.value);
-            badge.title = `${params.value} modified cells in ${group.name}`;
-            badge.setAttribute('aria-label', badge.title);
-          }
-          return badge;
-        },
-      },
+    // The rail stands in for the whole group while collapsed, so every real child is 'open'.
+    children: [
+      railColDef(group, level, options),
       ...children.map((child) => ({ ...child, columnGroupShow: 'open' as const })),
-    ];
-  }
-  const pendingColumn = options.pendingColumn;
-  if (
-    pendingColumn &&
-    pendingColumn.editingCode === group.code &&
-    pendingColumn.editingKind === 'group'
-  ) {
-    def.headerClass = [groupHeaderClass, 'pending-column-header'];
-    def.headerGroupComponent = PendingColumnHeaderComponent;
-    def.headerGroupComponentParams = {
-      code: group.code,
-      kind: 'group',
-      onNameChange: pendingColumn.onGroupNameChange ?? pendingColumn.onNameChange,
-      validateName: pendingColumn.validateGroupName ?? pendingColumn.validateName,
-      onInvalidChange: pendingColumn.onInvalidChange,
-    };
-  }
-  return def;
+    ],
+  };
 }

 function toLeafColDef(
   column: SignalColumn,
-  {
-    editMode = false,
-    isRowRemoved,
-    isColumnRemoved,
-    pendingColumn,
-    validatorView,
-    trackingEnabled,
-  }: SignalColumnDefOptions,
+  { selectOptionsFor }: SignalColumnDefOptions,
 ): ColDef<SignalRow> {
-  const columnRemoved = isColumnRemoved?.(column.code) ?? false;
-  const cellEditMode = (row: SignalRow | undefined): boolean =>
-    editMode && !columnRemoved && !isRowRemoved?.(row);
-  const context: ModificationContext = { trackingEnabled };
-  const def: ColDef<SignalRow> = {
+  const filterParams: Pick<FilterRowCellParams, 'kind' | 'options'> = column.selectFilter
+    ? { kind: 'select', options: selectOptionsFor?.(column.code) ?? [] }
+    : { kind: column.groupCode ? 'search-sort' : 'search-filter' };
+  return {
     colId: column.code,
     headerName: column.name,
-    headerClass: columnRemoved ? 'column-removed' : undefined,
-    cellDataType: false,
-    valueFormatter: (params: ValueFormatterParams<SignalRow>) => toCellText(params.value),
-    cellClass: (params: CellClassParams<SignalRow>) =>
-      cellClasses(column, params.data, editMode, columnRemoved),
-    cellClassRules: {
-      'cell-modified': (params) => isModifiedCell(params.data, column.code, context),
-    },
+    field: `data.${column.code}` as ColDef<SignalRow>['field'],
+    filter: 'agTextColumnFilter',
+    floatingFilterComponent: FilterRowCell,
+    floatingFilterComponentParams: filterParams,
+    suppressFloatingFilterButton: true,
   };
-  if (validatorView && !editMode) {
-    def.cellRendererSelector = (params) =>
-      isModifiedCell(params.data, column.code, context)
-        ? { component: SignalChangeRenderer }
-        : undefined;
-  }
-  if (column.formula) {
-    def.calculatedExpression = column.formula;
-  } else {
-    def.field = `data.${column.code}` as ColDef<SignalRow>['field'];
-    def.editable = (params: EditableCallbackParams<SignalRow>) =>
-      isCellEditable(column, params.data, cellEditMode(params.data));
-    def.valueParser = (params: ValueParserParams<SignalRow>) => toExcelCellValue(params.newValue);
-  }
-  if (
-    !columnRemoved &&
-    pendingColumn &&
-    ((isPendingColumnCode(column.code) && !column.name.trim()) ||
-      (pendingColumn.editingCode === column.code &&
-        (pendingColumn.editingKind ?? 'column') === 'column'))
-  ) {
-    def.headerClass = 'pending-column-header';
-    def.headerComponent = PendingColumnHeaderComponent;
-    def.headerComponentParams = {
-      code: column.code,
-      kind: 'column',
-      onNameChange: pendingColumn.onNameChange,
-      validateName: pendingColumn.validateName,
-      onInvalidChange: pendingColumn.onInvalidChange,
-    };
-    def.editable = (params: EditableCallbackParams<SignalRow>) =>
-      isCellEditable(column, params.data, cellEditMode(params.data));
-  }
-  return def;
 }

-function isCellLocked(column: SignalColumn, row: SignalRow | undefined): boolean {
-  return column.locked || !!row?.locked || !!row?.lockedColumnCodes.includes(column.code);
-}
-
-function isCellEditable(
-  column: SignalColumn,
-  row: SignalRow | undefined,
-  editMode: boolean,
-): boolean {
-  return (
-    editMode &&
-    column.permission === TabPermission.Edit &&
-    !column.formula &&
-    !!row &&
-    !isCellLocked(column, row)
-  );
-}
-
-function cellClasses(
-  column: SignalColumn,
-  row: SignalRow | undefined,
-  editMode: boolean,
-  columnRemoved = false,
-): string[] {
-  const classes: string[] = [];
-  if (isCellLocked(column, row)) {
-    classes.push('cell-locked');
-  }
-  if (columnRemoved) {
-    classes.push('column-removed');
-  }
-  if (isCellEditable(column, row, editMode)) {
-    classes.push('cell-input');
-  }
-  return classes;
-}
-
-function rowNoColDef(): ColDef<SignalRow> {
-  return {
-    colId: ROW_NO_COL_ID,
-    headerName: 'No#',
-    valueGetter: (params) => (params.node?.rowIndex ?? 0) + 1,
-    pinned: 'left',
-    width: 64,
-    minWidth: 64,
-    resizable: false,
-    editable: false,
-    suppressMovable: true,
-    cellClass: 'cell-row-index',
-  };
-}
-
-function revisionColDef({ trackingEnabled }: SignalColumnDefOptions): ColDef<SignalRow> {
-  const context: ModificationContext = { trackingEnabled };
-  return {
-    colId: REVISION_COL_ID,
-    headerName: 'Revision',
-    valueGetter: (params) => params.data?.revisionLabel ?? '-',
-    width: 130,
-    editable: false,
-    suppressMovable: true,
-    cellClass: 'cell-revision',
-    cellClassRules: {
-      'cell-modified': (params) => hasModifications(params.data, context),
-    },
-  };
-}
-
+/**
+ * The column shown in place of a collapsed group. Its header (RailLabelHeader) draws the badge,
+ * the rail and the group's name, from the header down to the bottom of the table; the body cells
+ * are plain rail colour under it.
+ */
 function railColDef(
   group: SignalGroup,
-  levelClass: string,
-  changeCount: number,
+  level: string,
+  { changeCountFor }: SignalColumnDefOptions,
 ): ColDef<SignalRow> {
   return {
     colId: `${group.code}${RAIL_COL_ID}`,
     headerName: group.name,
     columnGroupShow: 'closed',
-    width: 38,
-    minWidth: 38,
-    maxWidth: 38,
+    width: RAIL_WIDTH,
+    minWidth: RAIL_WIDTH,
+    maxWidth: RAIL_WIDTH,
+    // Opt out of the default flex, which would otherwise only be held back by maxWidth.
+    flex: 0,
     resizable: false,
     sortable: false,
     filter: false,
@@ -295,21 +111,47 @@
     suppressNavigable: true,
     suppressMovable: true,
     wrapHeaderText: false,
+    // The header fills its cell, so measuring it for auto height would grow the row forever.
     autoHeaderHeight: false,
-    headerClass: `signal-rail ${levelClass}`,
-    cellClass: `signal-rail-cell ${levelClass}`,
-    headerComponent: CollapsedGroupHeader,
-    headerComponentParams: { changeCount },
+    headerClass: `signal-rail ${level}`,
+    cellClass: `signal-rail-cell ${level}`,
+    headerComponent: RailLabelHeader,
+    headerComponentParams: { changeCount: changeCountFor?.(group.code) ?? 0 },
     valueGetter: () => '',
   };
 }

-function descendantCodes(children: SignalColDef[]): string[] {
-  return children.flatMap((child) =>
-    'children' in child
-      ? descendantCodes(child.children)
-      : child.colId && !child.colId.startsWith('__changes_')
-        ? [child.colId]
-        : [],
-  );
+function rowNoColDef(): ColDef<SignalRow> {
+  return {
+    colId: ROW_NO_COL_ID,
+    headerName: 'No#',
+    valueGetter: ({ node }) => (node?.rowIndex ?? 0) + 1,
+    pinned: 'left',
+    lockPinned: true,
+    width: 48,
+    minWidth: 48,
+    flex: 0,
+    resizable: false,
+    filter: false,
+    suppressMovable: true,
+    cellClass: 'cell-row-index',
+  };
 }
+
+function revisionColDef(): ColDef<SignalRow> {
+  return {
+    colId: REVISION_COL_ID,
+    headerName: 'Revision',
+    valueGetter: ({ data }) => data?.revisionLabel ?? '-',
+    width: 110,
+    flex: 0,
+    filter: 'agTextColumnFilter',
+    floatingFilterComponent: FilterRowCell,
+    floatingFilterComponentParams: { kind: 'search-filter' } satisfies Pick<
+      FilterRowCellParams,
+      'kind'
+    >,
+    suppressFloatingFilterButton: true,
+    suppressMovable: true,
+  };
+}
```

</details>

<details>
<summary>collapsed-header.component.ts → rail-label-header.ts</summary>

```diff
--- ref/collapsed-header.component.ts
+++ rail-header-label/rail-label-header.ts
@@ -1,103 +1,58 @@
-import {
-  ChangeDetectionStrategy,
-  Component,
-  ElementRef,
-  inject,
-  OnDestroy,
-  signal,
-} from '@angular/core';
-import { SignalRow } from '@domain/signal/signal.model';
+import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
 import type { IHeaderAngularComp } from 'ag-grid-angular';
 import type { IHeaderParams } from 'ag-grid-community';
+import type { SignalRow } from './signal.model';

-const LAYOUT_EVENTS = ['columnGroupOpened', 'columnResized', 'newColumnsLoaded'] as const;
-
-export interface CollapsedGroupHeaderParams extends IHeaderParams<SignalRow> {
+export interface RailLabelHeaderParams extends IHeaderParams<SignalRow> {
+  /** Total changed cells in the group, shown in the badge. */
   changeCount: number;
 }

 /**
- * Column header shown in place of a collapsed group: change count plus the rotated
- * group name. Used as the headerComponent of the group's rail column.
+ * Header of a collapsed group's rail column, and the whole rail: the change badge, then the
+ * rotated group name, on the rail's colour, reaching from the header down past the bottom of the
+ * table (cut off there by the grid). It lives in the header, which stays put while rows scroll,
+ * so the name does too, with nothing to keep in step. The one thing it can't do on its own is
+ * stay under the pinned columns when scrolled sideways: rail-header-label-rails.css clips the
+ * header at the pinned edge for that.
+ *
+ * With no changes the badge is hidden but keeps its space, so names start at the same height on
+ * every rail. The name is the whole name, read bottom to top: one longer than the table is cut
+ * off at its bottom.
  */
 @Component({
-  selector: 'app-collapsed-group-header',
+  selector: 'app-rail-label-header',
   changeDetection: ChangeDetectionStrategy.OnPush,
   host: {
     class:
-      'flex h-full w-full flex-col items-center gap-2 bg-[var(--group-bg)] py-1.5 shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)]',
+      'flex h-[calc(100%+100vh)] w-full flex-col items-center gap-2 overflow-hidden pt-2 ' +
+      'bg-(--group-bg) shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)]',
+    '[attr.title]': 'label()',
   },
-  templateUrl: './collapsed-header.component.html',
+  template: `
+    <span
+      class="h-5 min-w-5 shrink-0 rounded bg-(--signal-badge-bg) px-1 text-center text-xs leading-5 font-semibold text-(--signal-badge-fg)"
+      [class.invisible]="changeCount() === 0"
+      aria-hidden="true"
+      >{{ changeCount() }}</span
+    >
+    <span
+      class="shrink-0 rotate-180 text-sm leading-5 font-medium whitespace-nowrap [writing-mode:vertical-rl]"
+      >{{ label() }}</span
+    >
+  `,
 })
-export class CollapsedGroupHeader implements IHeaderAngularComp, OnDestroy {
-  private readonly host: HTMLElement = inject(ElementRef).nativeElement;
+export class RailLabelHeader implements IHeaderAngularComp {
   protected readonly label = signal('');
   protected readonly changeCount = signal(0);
-  private api?: IHeaderParams<SignalRow>['api'];
-  private viewport: HTMLElement | null = null;
-  private frame = 0;
-  /** Layout measured once per layout change so scrolling only does arithmetic. */
-  private contentLeft = 0;
-  private pinnedRight = 0;

-  agInit(params: CollapsedGroupHeaderParams): void {
-    this.api = params.api;
-    for (const type of LAYOUT_EVENTS) params.api.addEventListener(type, this.onLayoutChange);
-    this.onLayoutChange();
+  agInit(params: RailLabelHeaderParams): void {
     this.refresh(params);
   }

-  refresh(params: CollapsedGroupHeaderParams): boolean {
+  refresh(params: RailLabelHeaderParams): boolean {
     this.label.set(params.displayName);
     this.changeCount.set(params.changeCount);
     return true;
   }
-
-  private measure(): void {
-    const viewport = this.host.closest<HTMLElement>('.ag-grid-viewport');
-    if (viewport !== this.viewport) {
-      this.viewport?.removeEventListener('scroll', this.onScroll);
-      viewport?.addEventListener('scroll', this.onScroll, { passive: true });
-      this.resizeObserver.disconnect();
-      if (viewport) this.resizeObserver.observe(viewport);
-      this.viewport = viewport;
-    }
-    const pinned = this.host.closest('.ag-header')?.querySelector('.ag-grid-pinned-left-cells');
-    this.pinnedRight = pinned?.getBoundingClientRect().right ?? 0;
-    const hostRect = this.host.getBoundingClientRect();
-    this.contentLeft = hostRect.left + (viewport?.scrollLeft ?? 0);
-    if (viewport) {
-      // The rail runs from its own top down to the bottom of the scrollable area.
-      const top = hostRect.top - viewport.getBoundingClientRect().top;
-      this.host.style.height = `${Math.max(viewport.clientHeight - top, 0)}px`;
-    }
-    this.applyClip();
-  }
-
-  private readonly onLayoutChange = () => {
-    cancelAnimationFrame(this.frame);
-    this.frame = requestAnimationFrame(() => this.measure());
-  };
-
-  private readonly onScroll = () => this.applyClip();
-
-  private readonly resizeObserver = new ResizeObserver(() => this.onLayoutChange());
-
-  /**
-   * The rotated name overflows the header into the body, where it would be painted over the
-   * pinned columns; hide only the part that sits under them.
-   */
-  private applyClip(): void {
-    const overlap = this.pinnedRight - (this.contentLeft - (this.viewport?.scrollLeft ?? 0));
-    this.host.style.clipPath = overlap > 0 ? `inset(-9999px 0 -9999px ${overlap}px)` : '';
-  }
-
-  ngOnDestroy(): void {
-    cancelAnimationFrame(this.frame);
-    this.resizeObserver.disconnect();
-    if (this.api && !this.api.isDestroyed()) {
-      for (const type of LAYOUT_EVENTS) this.api.removeEventListener(type, this.onLayoutChange);
-    }
-    this.viewport?.removeEventListener('scroll', this.onScroll);
-  }
 }
```

</details>

<details>
<summary>signal-grid.component.ts → rail-header-label.ts</summary>

```diff
--- ref/signal-grid.component.ts
+++ rail-header-label/rail-header-label.ts
@@ -2,469 +2,180 @@
   ChangeDetectionStrategy,
   Component,
   computed,
-  DOCUMENT,
-  effect,
+  DestroyRef,
   ElementRef,
   inject,
-  input,
-  output,
   signal,
-  untracked,
-  viewChild,
   ViewEncapsulation,
 } from '@angular/core';
 import { AgGridAngular } from 'ag-grid-angular';
 import {
-  CellValueChangedEvent,
-  CellFocusedEvent,
-  CellPosition,
-  ColDef,
-  ColumnGroupOpenedEvent,
-  GetRowIdParams,
-  GridApi,
-  GridReadyEvent,
-  NavigateToNextCellParams,
-  RowClassParams,
-  TabToNextCellParams,
+  AllCommunityModule,
+  themeQuartz,
+  type ColDef,
+  type ColumnGroupOpenedEvent,
+  type GetRowIdParams,
+  type GridApi,
+  type GridReadyEvent,
 } from 'ag-grid-community';
-import { ContentMode } from '@core/models/common.model';
-import { MESSAGES } from '@core/constants/messages.constants';
-import { SignalGridToolbar } from './renderers/toolbars/signal-grid-toolbars.component';
+import { ServerSideRowModelApiModule, ServerSideRowModelModule } from 'ag-grid-enterprise';
 import {
-  buildSignalColumnDefs,
-  REVISION_COL_ID,
-  ROW_NO_COL_ID,
-} from './columns/build-signal-column-defs';
-import { SignalGridContextMenu } from './context-menu/signal-grid-context-menu';
-import { readGroupsExpansion, setGroupsOpen, syncParentGroup } from './groups/signal-group-state';
-import { createSignalFormulaFuncs } from './formula/signal-formula-funcs';
-import { createSignalGridDatasource, SIGNAL_GRID_BLOCK_SIZE } from './data/signal-grid-datasource';
-import { SIGNAL_GRID_MODULES } from './signal-grid.modules';
-import { SignalApi } from '../signal.api';
-import { isPendingColumnCode } from '../pending-column-code';
-import {
-  AddSignalRowRequest,
-  PendingColumnName,
-  PendingSignalColumn,
-  PendingSignalRowGroup,
-  RemovedSignal,
-  SignalCellChange,
-  SignalCellEdits,
-  SignalHeaderTarget,
-  SignalRow,
-  SignalStructure,
-} from '../signal.model';
-import { ColumnInsertionSide, RowInsertionSide } from '../signal.enum';
-import { RowEditPermission } from '../signal-row-edit.rule';
-import { ToastService } from '@core/services/toast.service';
-import { hasModifications } from '../signal-modifications';
+  columnOptions,
+  createSignalDatasource,
+  INITIALLY_OPEN_GROUPS,
+  SIGNAL_COLUMNS,
+  SIGNAL_GROUPS,
+  SIGNAL_ROWS,
+} from './signal-data';
+import type { SignalRow } from './signal.model';
+import { clipHeaderAtPinnedEdge } from './clip-header-at-pinned-edge';
+import { buildSignalColumnDefs } from './columns/build-signal-column-defs';

-const SIGNAL_GRID_ROW_HEIGHT = 40;
-const SIGNAL_GRID_EDIT_ROW_HEIGHT = 60;
+/** Leaf column codes under a group, nested groups included. */
+function groupColumnCodes(groupCode: string): string[] {
+  const childGroups = SIGNAL_GROUPS.filter(({ parentCode }) => parentCode === groupCode);
+  return [
+    ...SIGNAL_COLUMNS.filter((column) => column.groupCode === groupCode).map(({ code }) => code),
+    ...childGroups.flatMap(({ code }) => groupColumnCodes(code)),
+  ];
+}

+const chevron = (path: string) =>
+  `<svg class="signal-chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="${path}"/></svg>`;
+
+/**
+ * The signal grid's collapsed-group rails, styled after the Signal List Management Figma frame,
+ * with each rail drawn whole by its header component (RailLabelHeader): the table and column defs
+ * are the ref's, and the only addition is CSS (rail-header-label-rails.css) that cuts the header
+ * off at the pinned edge as it scrolls sideways.
+ */
 @Component({
-  selector: 'app-signal-grid',
+  selector: 'app-rail-header-label',
+  imports: [AgGridAngular],
+  template: `
+    <main class="signal-page">
+      <header class="signal-toolbar">
+        <h1>Signal Data</h1>
+        <div class="signal-controls" role="group" aria-label="Table controls">
+          <button type="button" (click)="setGroupsOpen(true)">Expand all</button>
+          <button type="button" (click)="setGroupsOpen(false)">Collapse all</button>
+          <label>
+            <input
+              type="checkbox"
+              [checked]="filtersHidden()"
+              (change)="setFiltersHidden($event)"
+            />
+            Hide Filter/Search
+          </label>
+        </div>
+      </header>
+      <ag-grid-angular
+        class="signal-grid rail-header-labels"
+        [modules]="modules"
+        [theme]="theme"
+        rowModelType="serverSide"
+        [serverSideDatasource]="datasource"
+        [cacheBlockSize]="100"
+        [getRowId]="getRowId"
+        [columnDefs]="columnDefs"
+        [defaultColDef]="defaultColDef()"
+        [icons]="icons"
+        [rowHeight]="44"
+        [hidePaddedHeaderRows]="true"
+        (gridReady)="onGridReady($event)"
+        (columnGroupOpened)="onColumnGroupOpened($event)"
+      />
+    </main>
+  `,
+  styleUrls: ['./rail-header-label.css', './rail-header-label-rails.css'],
   changeDetection: ChangeDetectionStrategy.OnPush,
-  imports: [AgGridAngular, SignalGridToolbar],
-  templateUrl: './signal-grid.component.html',
-  styleUrl: './signal-grid.component.css',
   encapsulation: ViewEncapsulation.None,
-  host: {
-    class: 'relative block',
-    '(document:fullscreenchange)': 'syncFullScreen()',
-    '(contextmenu)': 'contextMenu.onNativeContextMenu($event)',
-  },
 })
-export class SignalGridComponent {
-  private readonly api = inject(SignalApi);
-  private readonly toast = inject(ToastService);
-  private readonly document = inject(DOCUMENT);
+export class RailHeaderLabel {
+  private readonly destroyRef = inject(DestroyRef);
+  private readonly host: HTMLElement = inject(ElementRef).nativeElement;

-  private readonly signalGrid = viewChild.required<ElementRef<HTMLElement>>('signalGrid');
+  protected readonly filtersHidden = signal(false);

-  readonly structure = input<SignalStructure | null>(null);
-  readonly dataStructure = input<SignalStructure | null>(null);
-  readonly loading = input(false);
-  readonly mode = input<ContentMode>('view');
-  readonly showRevisionColumn = input(true);
-  readonly canModifyColumns = input(false);
-  readonly canRemoveSavedColumns = input(false);
-  readonly tabInfoValues = input<Record<string, string | null>>({});
-  readonly validateColumnName = input<
-    (request: PendingColumnName) => Promise<string | null | undefined>
-  >(async () => null);
-  readonly validateGroupName = input<
-    (request: PendingColumnName) => Promise<string | null | undefined>
-  >(async () => null);
-  readonly editingHeader = input<SignalHeaderTarget | null>(null);
-  readonly editingHeaderChange = output<SignalHeaderTarget | null>();
-  readonly headerEditErrorChange = output<string | null>();
-  readonly addColumn = output<PendingSignalColumn>();
-  readonly removeColumn = output<string>();
-  readonly restoreColumn = output<string>();
-  readonly removedColumnCodes = input<string[]>([]);
-  readonly renamePendingColumn = output<PendingColumnName>();
-  readonly renameColumn = output<PendingColumnName>();
-  readonly renameGroup = output<PendingColumnName>();
-  readonly cellEdits = input<SignalCellEdits>({});
-  readonly cellChange = output<SignalCellChange>();
-  readonly rowEditPermission = input<RowEditPermission | null>(null);
-  readonly deleteRow = output<SignalRow>();
-  readonly restoreRow = output<SignalRow>();
-  readonly removedSignals = input<RemovedSignal[]>([]);
-  readonly addedSignals = input<PendingSignalRowGroup[]>([]);
-  readonly addedRowRevisionLabel = input<string | null>(null);
-  readonly addRow = output<AddSignalRowRequest>();
-  private readonly removedIds = computed(
-    () => new Set(this.removedSignals().map((removal) => removal.signalId)),
-  );
-  readonly validatorView = input(false);
-  readonly changesSummary = input(false);
-  protected readonly summaryEmpty = signal(false);
-  protected readonly summaryActive = computed(() =>
-    this.changesSummary() && this.structure()?.trackingEnabled === true,
-  );
-  private readonly removedColumnSet = computed(() => new Set(this.removedColumnCodes()));
-
-  private gridApi: GridApi<SignalRow> | null = null;
-  private readonly localEditingHeader = signal<SignalHeaderTarget | null>(null);
-  protected readonly fullScreen = signal(false);
-  protected readonly allGroupsExpanded = signal(true);
-  protected readonly allGroupsCollapsed = signal(false);
-  private readonly activeEditingHeader = computed(
-    () => this.editingHeader() ?? this.localEditingHeader(),
-  );
-  protected readonly contextMenu = new SignalGridContextMenu({
-    api: () => this.gridApi,
-    mode: this.mode,
-    structure: this.structure,
-    removedIds: this.removedIds,
-    removedColumns: this.removedColumnSet,
-    canModifyColumns: this.canModifyColumns,
-    canRemoveSavedColumns: this.canRemoveSavedColumns,
-    rowEditPermission: this.rowEditPermission,
-    activeEditingHeader: this.activeEditingHeader,
-    startEditingHeader: (target) => this.startEditingHeader(target),
-    requestAddRow: (row, side) => this.requestAddRow(row, side),
-    requestAddColumn: (code, side) => this.requestAddColumn(code, side),
-    clearEditingHeader: () => this.setEditingHeader(null),
-    deleteRow: this.deleteRow,
-    restoreRow: this.restoreRow,
-    removeColumn: this.removeColumn,
-    restoreColumn: this.restoreColumn,
-  });
-
-  protected readonly modules = SIGNAL_GRID_MODULES;
-  protected readonly blockSize = SIGNAL_GRID_BLOCK_SIZE;
-
-  protected readonly icons = {
-    columnGroupOpened: '<span class="icon-chevron-right"></span>',
-    columnGroupClosed: '<span class="icon-chevron-down"></span>',
-  };
-
-  protected readonly columnDefs = computed(() => {
-    const structure = this.structure();
-    const removedColumns = this.removedColumnSet();
-    return structure
-      ? buildSignalColumnDefs(structure.groups, structure.columns, {
-          editMode: this.mode() === 'edit',
-          isRowRemoved: (row) => !!row && untracked(this.removedIds).has(row.signalId),
-          isColumnRemoved: (code) => removedColumns.has(code),
-          showRevision: this.showRevisionColumn(),
-          trackingEnabled: structure.trackingEnabled,
-          validatorView: this.validatorView(),
-          pendingColumn: {
-            onNameChange: (code, name) => {
-              this.setEditingHeader(null);
-              if (isPendingColumnCode(code)) {
-                this.renamePendingColumn.emit({ code, name });
-              } else {
-                this.renameColumn.emit({ code, name });
-              }
-            },
-            validateName: (code, name) => this.validateColumnName()({ code, name }),
-            onGroupNameChange: (code, name) => {
-              this.setEditingHeader(null);
-              this.renameGroup.emit({ code, name });
-            },
-            validateGroupName: (code, name) => this.validateGroupName()({ code, name }),
-            onInvalidChange: (error) => this.headerEditErrorChange.emit(error),
-            editingCode: this.activeEditingHeader()?.code ?? null,
-            editingKind: this.activeEditingHeader()?.kind ?? null,
-          },
-        })
-      : [];
-  });
-
-  protected readonly datasource = computed(() => {
-    const structure = this.dataStructure() ?? this.structure();
-    return structure
-      ? createSignalGridDatasource(
-          this.api,
-          structure,
-          SIGNAL_GRID_BLOCK_SIZE,
-          () => untracked(this.cellEdits),
-          () => untracked(this.addedSignals),
-          () => untracked(this.addedRowRevisionLabel),
-        )
-      : undefined;
-  });
-
-  private appliedRemovedIds = new Set<string>();
-  private summaryApplied = false;
-  private appliedRemovedColumns = new Set<string>();
-
-  constructor() {
-    effect(() => {
-      this.addedSignals();
-      untracked(() => this.gridApi?.refreshServerSide({ purge: true }));
-    });
-    effect(() => {
-      const removedIds = this.removedIds();
-      untracked(() => this.redrawChangedRows(removedIds));
-    });
-    effect(() => {
-      const edits = this.cellEdits();
-      this.tabInfoValues();
-      this.gridApi?.forEachNode((node) => {
-        if (!node.data) return;
-        const rowEdits = edits[node.data.signalId] ?? {};
-        for (const [code, previous] of Object.entries(node.data.draftChanges ?? {})) {
-          if (!Object.hasOwn(rowEdits, code)) node.data.data[code] = previous.saved;
-        }
-        for (const [code, edit] of Object.entries(rowEdits)) {
-          node.data.data[code] = edit.value;
-        }
-        node.data.draftChanges = rowEdits;
-      });
-      this.gridApi?.refreshFormulas();
-      this.gridApi?.refreshCells({ force: true });
-      untracked(() => this.updateSummaryVisibility());
-    });
-    effect(() => {
-      this.summaryActive();
-      this.rowHeight();
-      this.removedIds();
-      untracked(() => this.updateSummaryVisibility());
-    });
-    effect(() => {
-      const removedColumns = this.removedColumnSet();
-      untracked(() => this.redrawChangedColumns(removedColumns));
-    });
-  }
-
-  private isSummaryHidden(row: SignalRow | undefined): boolean {
-    return !!row && this.summaryActive() &&
-      !this.removedIds().has(row.signalId) &&
-      !hasModifications(row, { trackingEnabled: this.structure()?.trackingEnabled });
-  }
-
-  protected updateSummaryVisibility(): void {
-    const api = this.gridApi;
-    if (!api) return;
-    if (!this.summaryActive() && !this.summaryApplied) return;
-    this.summaryApplied = this.summaryActive();
-    let loaded = 0;
-    let visible = 0;
-    let changed = false;
-    api.forEachNode((node) => {
-      if (!node.data) return;
-      loaded++;
-      const hidden = this.isSummaryHidden(node.data);
-      if (!hidden) visible++;
-      const height = hidden ? 0 : this.rowHeight();
-      if (node.rowHeight !== height) {
-        node.setRowHeight(height);
-        changed = true;
-      }
-    });
-    this.summaryEmpty.set(this.summaryActive() && loaded > 0 && visible === 0);
-    const focused = api.getFocusedCell();
-    if (focused && this.isSummaryHidden(api.getDisplayedRowAtIndex(focused.rowIndex)?.data)) {
-      api.clearFocusedCell();
-    }
-    if (changed) {
-      // Preserve formula row indexes: collapse presentation, never filter the row model.
-      api.onRowHeightChanged();
-      api.redrawRows();
-    }
-  }
-
-  private nextVisibleCell(position: CellPosition | null, direction: number): CellPosition | null {
-    if (!position || position.rowIndex < 0 || !this.summaryActive()) return position;
-    let rowIndex = position.rowIndex;
-    while (rowIndex >= 0 && rowIndex < (this.gridApi?.getDisplayedRowCount() ?? 0)) {
-      const node = this.gridApi?.getDisplayedRowAtIndex(rowIndex);
-      if (!this.isSummaryHidden(node?.data)) return { ...position, rowIndex };
-      rowIndex += direction;
-    }
-    return null;
-  }
-
-  protected readonly navigateToNextCell = (params: NavigateToNextCellParams<SignalRow>) =>
-    this.nextVisibleCell(params.nextCellPosition, params.key === 'ArrowUp' ? -1 : 1);
-
-  protected readonly tabToNextCell = (params: TabToNextCellParams<SignalRow>) =>
-    this.nextVisibleCell(params.nextCellPosition, params.backwards ? -1 : 1) ?? false;
-
-  protected onCellFocused(event: CellFocusedEvent<SignalRow>): void {
-    const api = this.gridApi;
-    if (!api || event.rowIndex === null || !event.column ||
-      !this.isSummaryHidden(api.getDisplayedRowAtIndex(event.rowIndex)?.data)) return;
-    const position = api.getFocusedCell();
-    const next = this.nextVisibleCell(position, 1) ?? this.nextVisibleCell(position, -1);
-    if (next) api.setFocusedCell(next.rowIndex, next.column, next.rowPinned);
-    else api.clearFocusedCell();
-  }
-
-  private redrawChangedRows(removedIds: Set<string>): void {
-    const previous = this.appliedRemovedIds;
-    this.appliedRemovedIds = removedIds;
-    const api = this.gridApi;
-    if (!api) return;
-
-    const changedIds = [
-      ...[...removedIds].filter((signalId) => !previous.has(signalId)),
-      ...[...previous].filter((signalId) => !removedIds.has(signalId)),
-    ];
-    const rowNodes = changedIds.flatMap((signalId) => api.getRowNode(signalId) ?? []);
-    if (rowNodes.length > 0) api.redrawRows({ rowNodes });
-  }
-
-  private redrawChangedColumns(removedColumns: Set<string>): void {
-    const previous = this.appliedRemovedColumns;
-    this.appliedRemovedColumns = removedColumns;
-    const api = this.gridApi;
-    if (!api) return;
-
-    const changed =
-      removedColumns.size !== previous.size ||
-      [...removedColumns].some((code) => !previous.has(code));
-    if (changed) {
-      api.refreshHeader();
-      api.redrawRows();
-    }
-  }
-
-  protected readonly getRowClass = (params: RowClassParams<SignalRow>): string[] => [
-    ...(params.data && this.removedIds().has(params.data.signalId) ? ['row-removed'] : []),
-    ...(this.isSummaryHidden(params.data) ? ['row-summary-hidden'] : []),
-  ];
-
-  protected readonly rowHeight = computed(() =>
-    this.mode() === 'edit' ? SIGNAL_GRID_EDIT_ROW_HEIGHT : SIGNAL_GRID_ROW_HEIGHT,
-  );
-
-  protected readonly defaultColDef: ColDef<SignalRow> = {
-    minWidth: 120,
+  protected readonly defaultColDef = computed((): ColDef<SignalRow> => ({
+    minWidth: 140,
     flex: 1,
     resizable: true,
     sortable: false,
     wrapHeaderText: true,
     autoHeaderHeight: true,
     suppressHeaderMenuButton: true,
-  };
+    floatingFilter: !this.filtersHidden(),
+  }));

-  protected readonly formulaFuncs = createSignalFormulaFuncs({
-    tabInfo: () => this.tabInfoValues(),
+  private gridApi: GridApi<SignalRow> | null = null;
+  protected readonly columnDefs = buildSignalColumnDefs(SIGNAL_GROUPS, SIGNAL_COLUMNS, {
+    changeCountFor: (groupCode) => this.changeCount(groupCode),
+    selectOptionsFor: columnOptions,
   });
+  protected readonly modules = [
+    AllCommunityModule,
+    ServerSideRowModelModule,
+    ServerSideRowModelApiModule,
+  ];
+  protected readonly datasource = createSignalDatasource(() => SIGNAL_ROWS);
+  // As in Figma: an open group shows a right chevron, a collapsed one (its rail) a down one.
+  protected readonly icons = {
+    columnGroupOpened: chevron('m7.5 15 5-5-5-5'),
+    columnGroupClosed: chevron('m5 7.5 5 5 5-5'),
+  };
+  // Colours and sizes from the Figma variables (see rail-header-label.css for the tokens).
+  protected readonly theme = themeQuartz.withParams({
+    fontFamily: 'Inter, sans-serif',
+    fontSize: 14,
+    foregroundColor: '#181d27',
+    backgroundColor: '#ffffff',
+    headerBackgroundColor: '#ffffff',
+    headerTextColor: '#414651',
+    headerFontWeight: 500,
+    borderColor: '#e9eaeb',
+    wrapperBorder: false,
+    wrapperBorderRadius: 0,
+    rowBorder: false,
+    columnBorder: false,
+    headerColumnBorder: true,
+    headerColumnBorderHeight: '100%',
+    headerRowBorder: false,
+    cellHorizontalPadding: 12,
+    accentColor: '#004e50',
+    browserColorScheme: 'light',
+  });

-  private setEditingHeader(target: SignalHeaderTarget | null): void {
-    this.localEditingHeader.set(target);
-    this.editingHeaderChange.emit(target);
-    this.headerEditErrorChange.emit(null);
-  }
+  protected readonly getRowId = ({ data }: GetRowIdParams<SignalRow>) => data.signalId;

-  private requestAddRow(row: SignalRow, side: RowInsertionSide): void {
-    this.addRow.emit({ referenceSignalId: row.signalId, anchorIndex: row.serverIndex, side });
-  }
-
-  private requestAddColumn(code: string, side: ColumnInsertionSide): void {
-    if (this.hasPendingColumn()) {
-      this.toast.error(MESSAGES.signalColumn.finishEditingBeforeAdding);
-      return;
-    }
-    this.addColumn.emit({
-      referenceColumnCode: code,
-      side,
-      creationOrder: 0,
-      name: '',
-    });
-  }
-
-  private startEditingHeader(target: SignalHeaderTarget): void {
-    if (this.hasPendingColumn()) {
-      this.toast.error(MESSAGES.signalColumn.finishEditingBeforeEditing);
-      return;
-    }
-    this.setEditingHeader(target);
-  }
-
-  private hasPendingColumn(): boolean {
-    return (
-      this.activeEditingHeader() !== null ||
-      this.structure()?.columns.some(
-        (column) => isPendingColumnCode(column.code) && !column.name.trim(),
-      ) === true
+  protected onGridReady(event: GridReadyEvent<SignalRow>): void {
+    this.gridApi = event.api;
+    event.api.setGridAriaProperty('label', 'Signal data');
+    event.api.setColumnGroupState(
+      SIGNAL_GROUPS.map(({ code }) => ({ groupId: code, open: INITIALLY_OPEN_GROUPS.has(code) })),
     );
+    const grid = this.host.querySelector<HTMLElement>('.rail-header-labels');
+    if (grid) clipHeaderAtPinnedEdge(grid, this.destroyRef);
   }

-  protected readonly getRowId = (params: GetRowIdParams<SignalRow>): string => params.data.signalId;
-
-  protected onCellValueChanged(event: CellValueChangedEvent<SignalRow>): void {
-    const columnCode = event.column.getColId();
-    if (!event.data || columnCode === ROW_NO_COL_ID || columnCode === REVISION_COL_ID) return;
-    this.cellChange.emit({
-      signalId: event.data.signalId,
-      columnCode,
-      oldValue: event.oldValue ?? null,
-      value: event.newValue ?? null,
-    });
-  }
-
-  protected onColumnGroupOpened(event: ColumnGroupOpenedEvent<SignalRow>) {
-    for (const group of event.columnGroups) {
-      syncParentGroup(event.api, group);
-    }
-    this.syncGroupsState();
+  // As in the signal grid: header components are rebuilt on every toggle.
+  protected onColumnGroupOpened(event: ColumnGroupOpenedEvent<SignalRow>): void {
     event.api.refreshHeader();
   }

-  protected onGridReady(event: GridReadyEvent<SignalRow>): void {
-    this.gridApi = event.api;
-    this.syncGroupsState();
+  protected setGroupsOpen(open: boolean): void {
+    this.gridApi?.setColumnGroupState(SIGNAL_GROUPS.map(({ code }) => ({ groupId: code, open })));
   }

-  protected setGroupsExpanded(open: boolean): void {
-    const codes = this.structure()?.groups.map(({ code }) => code) ?? [];
-    if (this.gridApi) setGroupsOpen(this.gridApi, codes, open);
-    this.syncGroupsState();
+  protected setFiltersHidden(event: Event): void {
+    this.filtersHidden.set((event.target as HTMLInputElement).checked);
   }

-  protected syncGroupsState(): void {
-    const api = this.gridApi;
-    const groups = this.structure()?.groups ?? [];
-    if (!api || groups.length === 0) {
-      return;
-    }
-    const { allExpanded, allCollapsed } = readGroupsExpansion(
-      api,
-      groups.map(({ code }) => code),
+  private changeCount(groupCode: string): number {
+    const codes = groupColumnCodes(groupCode);
+    return SIGNAL_ROWS.reduce(
+      (total, row) => total + codes.filter((code) => row.modifiedCodes.includes(code)).length,
+      0,
     );
-    this.allGroupsExpanded.set(allExpanded);
-    this.allGroupsCollapsed.set(allCollapsed);
   }
-
-  protected toggleFullScreen(): void {
-    if (this.document.fullscreenElement) {
-      void this.document.exitFullscreen();
-      return;
-    }
-    this.signalGrid().nativeElement.requestFullscreen()
-      .catch(() => this.toast.error('Full screen is not available.'));
-  }
-
-  protected syncFullScreen(): void {
-    this.fullScreen.set(this.document.fullscreenElement === this.signalGrid().nativeElement);
-  }
 }
```

</details>
