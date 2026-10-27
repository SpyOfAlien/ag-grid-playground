# Tree table column layouts — views, scope and saved layouts

How the `/tree-table-lab` tables decide which columns to show, and how the signed-in user's column choices are saved per table, mode and sub-mode.

Code: `src/app/features/tree-table-lab/` · Route: `/tree-table-lab` · Fake API: `layout-api/`

## 1. What it is

The lab has three AG Grid tree tables in tabs: **BOM**, **Inbound** and **Outbound**. A table shows its columns through a **view**:

- BOM is _fixed_: it always shows the same clusters.
- Inbound and Outbound have **modes** (Transportation, Packaging, Days on hand, Capital employed, Replenishment time). Some modes have **sub-modes** (Transportation → All / Transportation / Empties).

Each view puts a set of **clusters** (column groups) in scope. Columns out of scope are hidden and cannot be turned on. Columns in scope can be hidden, shown, moved and resized by the user from the Columns panel, and that layout is saved **per user, per table, per mode and sub-mode**.

Users sign in with SSO. The server knows the user from the session, so the client never names one: there is no user switch, and no request carries a user id.

The grid's column defs are set once and never change. A view switch only applies column state, so the grid is never rebuilt: filters, sorting, expansion and selection survive it.

## 2. Terms

| Term         | Meaning                                                                            | Where                            |
| ------------ | ---------------------------------------------------------------------------------- | -------------------------------- |
| Table        | `bom`, `inbound` or `outbound` (`TableType`)                                       | `tree-table.model.ts`            |
| View         | `{ mode, subMode? }` (`ViewState`); `undefined` for a fixed table                  | `tree-table.model.ts`            |
| Cluster      | One column group (`ColGroupDef`) with its columns, getters, edit rules and markers | `clusters/*.ts`                  |
| In scope     | The clusters a view shows: always `core`, plus the mode's or sub-mode's clusters   | `views.ts` → `clustersInScope`   |
| Layout key   | String id of one view of one table, e.g. `inbound:transport:empties`               | `column-layout.ts` → `layoutKey` |
| Saved layout | `SavedColumn[]` for one key: in-scope columns, in order, with `hide` and `width`   | `tree-table.model.ts`            |

## 3. Files

| File                       | Role                                                                        |
| -------------------------- | --------------------------------------------------------------------------- |
| `tree-table-lab.ts`        | Page: tabs, the edit sessions and each table's view                         |
| `table-tab.ts`             | One tab: view switcher, reset button, grid, visible-column list, inspector  |
| `view-switcher.ts`         | Mode and sub-mode toggle buttons                                            |
| `views.ts`                 | Modes, sub-modes and which clusters each view puts in scope                 |
| `clusters/index.ts`        | Cluster registry and display order                                          |
| `clusters/<name>.ts`       | One cluster each                                                            |
| `clusters/shared/`         | Column builders, edit builders, the per-table context, shared marker rules  |
| `by-table.ts`              | `byTable()`: pick a per-table value at build time                           |
| `column-layout.ts`         | Pure functions: column defs per table, layout key, column state for a view  |
| `column-layout.service.ts` | Loads, caches and saves layouts over HTTP                                   |
| `tree-table.ts`            | The grid: applies a view's layout and saves user changes                    |
| `layout-api/`              | In-memory fake backend (interceptor + store); `SESSION_USER` is its session |
| `layout-inspector.ts`      | Shows the saved JSON, the user's keys and the API calls; can fail loads     |

## 4. Declaring columns

Column defs are built in five layers.

### 4.1 Column builders

`clusters/shared/columns.ts` (read-only):

- `text(colId, header, markers?, extra?)`: `TextCell`.
- `number(colId, header, { format, markers }, extra?)`: `NumberCell`, end-aligned.
- `computedNumber(colId, header, getter, how, display, extra?)`: a `number` with a `valueGetter` and no `field`, marked `systemGenerated` ("Calculated: …").

`clusters/shared/edit-columns.ts` (editable): `editNumber`, `editText`, `editNotes`, `dropdown`, `toggle`. Each picks a cells-kit renderer (Popover, Dialog, Dropdown or Toggle cell), adds the "Edited by a user" marker, and uses the table's edit rule unless `allowed` overrides it.

Every builder takes an `extra: Col`, spread last. It carries the column's **own defaults**: `initialWidth`, `initialHide`, and `context.dependsOn` (fields whose change should refresh the cell).

### 4.2 Per-table context

`clusterContext(table)` (`clusters/shared/cluster-context.ts`) gives every cluster:

- `table`
- `canEdit`: parents are locked; in outbound, shipped lines are locked too.
- `activeQuantity`: ordered quantity, or shipped quantity in outbound.
- The edit builders, already bound to that `canEdit`.

### 4.3 A cluster

A cluster is a function from the context to one column group:

```ts
export function emptyReturnCluster({ editNumber, toggle }: ClusterContext): Group {
  return {
    groupId: 'emptyReturnGroup', // must end in "Group"
    headerName: 'Empties',
    marryChildren: true, // its columns stay together
    children: [
      toggle('emptiesTracked', 'Tracked', (on) => (on ? 'Empties are tracked' : 'Not tracked'), {
        extra: { initialWidth: 100 },
      }),
      editNumber('emptyReturnDays', 'Return (days)', WHOLE, { … }),
      number('emptyReturnCost', 'Return cost', { format: EURO }, { initialWidth: 130 }),
    ],
  };
}
```

Values that differ by table are picked with `byTable` when the cluster is built:

```ts
byTable(table, { default: 'Quantity', outbound: 'Shipped qty' }); // most share, one differs
byTable(table, { outbound: [notFullyShipped] }); // only outbound; others get undefined
```

The cells kit owns the grid's `context`, so the table cannot be read at run time; each table builds its own columns instead.

### 4.4 Registry

`clusters/index.ts`:

- `clusterDefs(table)` builds all clusters with that table's context.
- `clusterOrder` is the left-to-right order of clusters in every table.

### 4.5 What the grid gets

`tableColumns(table)` in `column-layout.ts` runs once per table and is cached:

```ts
const clusters = clusterDefs(table);
collectDefaults(cluster, defaults); // colId → { hide: own initialHide, width }
const inScope = columnIdsInScope(table, resolveView(table), clusters); // the default view
const defs = allClustersForTable(table).map((id) => withStartHide(clusters[id], inScope));
```

- **`allClustersForTable`** keeps only the clusters some view of the table can show. BOM never gets the transport clusters; Inbound and Outbound never get `bomStructure`.
- **`collectDefaults`** records each column's _own_ default hide and width, read **before** `withStartHide` changes them. `buildColumnState` falls back to it when a view has nothing saved.
- **`withStartHide`** sets `initialHide` on every column outside the table's default view, so the first paint already shows the default view and nothing flashes.

The grid receives `columnsByTable(table)` once (`tree-table.ts`, read `untracked`), and the defs never change after that.

#### Two meanings of "hidden at start"

|             | Meaning                                                                                                    | Set by                                         |
| ----------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Own default | Hidden even when its view is active, until the user turns it on (`unit`, `safetyStock`, `packDimensions`…) | Cluster author: `extra: { initialHide: true }` |
| Start hide  | Hidden on the first paint because the default view doesn't include it                                      | `withStartHide`, per table                     |

AG Grid reads `initialHide` only when the grid is created; later visibility comes from `applyColumnState`. Keeping the two apart is what lets a column like `stockOnHand` start hidden in Inbound (default view: Transportation) yet show when the user switches to Days on hand.

## 5. Showing a view

### 5.1 Why a column is hidden

| Reason       | Source                                | User can change it?                          |
| ------------ | ------------------------------------- | -------------------------------------------- |
| Out of scope | `clustersInScope(table, view)`        | No. Its cluster is not in the Columns panel. |
| Own default  | `defaults` map, when nothing is saved | Yes                                          |
| User choice  | The saved layout                      | Yes                                          |

### 5.2 Flow

```
onGridReady ───┐
effect(view) ──┴─► show()
                    └─ layouts.load(table)          // GET once per table; cached afterwards
                         └─ applyLayout(current view)

applyLayout(view)
  key   = layoutKey(table, view)
  saved = layouts.get(key)    // undefined: nothing saved, or the load failed
  applying = true
  api.applyColumnState({ state: buildColumnState(table, view, saved), applyOrder: true })
  applied = { key, view }
  syncToolPanel()            // Columns panel lists only this view's clusters
  applying = false
  emit layoutKey and visible columns
```

- `load` answers at once once a table has loaded. While a `GET` is in flight, `loading` ignores further view switches; when it returns, the grid applies the view current at that moment, not the one that started the load.
- **A failed `GET`** emits `false` and caches nothing, so the view shows its defaults. The table is not marked loaded, so the next view switch tries the `GET` again.
- **Nothing is saved on a visit.** A view the user never changed has no saved layout and follows its defaults, including later changes to them.

### 5.3 `buildColumnState`

```
ordered       = saved ids still in scope (saved order) + in-scope ids not saved yet
inScopeState  = ordered → { colId, hide: saved?.hide ?? defaults.hide, width: saved?.width ?? defaults.width }
outOfScope    = every other column of the table → { colId, hide: true }
return [...inScopeState, ...outOfScope]
```

With `applyOrder: true` the list order is the column order, so a saved order comes back.

Example — Inbound → Days on hand, first visit (scope: `core` + `stockCoverage`):

```
quantity     hide:false  width:140
unit         hide:true   width:90    own default
stockOnHand  hide:false  width:110
daysOnHand   hide:false  width:110
safetyStock  hide:true   width:120   own default
…every other column   hide:true      out of scope
```

Nothing is saved yet. Once the user changes a column, `savedColumns` saves the five in-scope columns under `inbound:daysOnHand`.

## 6. Saving

### 6.1 Layout key

```ts
layoutKey('bom'); // bom:default
layoutKey('inbound', { mode: 'daysOnHand' }); // inbound:daysOnHand
layoutKey('inbound', { mode: 'transport', subMode: 'all' }); // inbound:transport:all
```

One saved layout per user per key. The key is used for the cache, the API URL, the per-key save timer, reset, and the inspector. Because the sub-mode is part of the key, Transportation → All and Transportation → Empties are separate layouts even though they share columns. The key starts with the table so `GET /<table>` can return a table's layouts by prefix. The user is not in the key: the server stores layouts by the session's user and key.

### 6.2 User changes

`onColumnVisible`, `onColumnMoved` and `onColumnResized` (the last two only when `finished`) call `onUserChange(source)`. It saves only when:

- `applying` is false (not our own `applyColumnState`), and
- the source is a user action: `toolPanelUi`, `toolPanelDragAndDrop`, `uiColumnMoved`, `uiColumnDragged`, `uiColumnResized`, `columnMenu`, `contextMenu`.

It saves `savedColumns(table, applied.view, api.getColumnState())` under `applied.key` — the view the grid was showing, not a newer one.

### 6.3 `ColumnLayoutService`

| Method                   | Does                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `load(table)`            | `GET` the table's layouts once and cache them, skipping keys with a save still pending. Emits `true`, or `false` if the `GET` failed (tried again next call) |
| `get(key)`               | Cached layout                                                                                                                                                |
| `queueSave(key, layout)` | Cache now, `PUT` after 500 ms of no further change; one timer per key                                                                                        |
| `reset(key)`             | Cancel pending save, drop from cache, `DELETE`                                                                                                               |

On `pagehide` the service sends every save still waiting at once, with `keepalive` so the request outlives the page. `keepalive` needs the fetch backend, so `app.config.ts` provides `HttpClient` with `withFetch()`.

### 6.4 API

| Method   | URL                          | Body / response                                         |
| -------- | ---------------------------- | ------------------------------------------------------- |
| `GET`    | `/api/column-layouts/:table` | `{ [layoutKey]: SavedColumn[] }` for the session's user |
| `PUT`    | `/api/column-layouts/:key`   | `SavedColumn[]` → 204                                   |
| `DELETE` | `/api/column-layouts/:key`   | 204                                                     |

The server takes the user from the SSO session; a request without one is the auth layer's 401. In the lab, `columnLayoutApiInterceptor` (registered in `app.config.ts`) answers from `ColumnLayoutStore` with 150 ms latency, as `SESSION_USER` (`anna`). The store is memory only: **a reload clears every layout.**

## 7. How to use

### 7.1 Try it in the lab

```bash
npm start
```

Open `http://127.0.0.1:4200/tree-table-lab`, then:

1. Open **Inbound**: the API log shows `GET /inbound` and nothing else; the store is empty.
2. Pick sub-mode **Empties**: only Item and Empties show. Nothing is saved.
3. Open **Columns** on the grid's right edge and hide a column: about 0.5 s later a `PUT` appears and the saved JSON shows.
4. Go to **All** and back to **Empties**: each keeps its own choice.
5. **Reset this view to default**: `DELETE`, the defaults come back, and nothing is saved.
6. Tick **Fail layout loads**, then open **Outbound** (not loaded yet): the `GET` fails and the default view shows. Untick it and switch mode: the `GET` runs again and saved layouts apply.

### 7.2 Add a column to a cluster

Add it to the cluster's `children` with a builder. Use a `colId` no other cluster uses. Set `initialWidth`, and `initialHide: true` if it should start hidden inside its view. Users with a saved layout get the new column at the end of the in-scope list, with its defaults.

### 7.3 Add a cluster

1. Add the id to `ClusterId` in `tree-table.model.ts`.
2. Create `clusters/<name>.ts` returning a `Group` with `groupId: '<name>Group'` and `marryChildren: true`.
3. Register it in `builders` and `clusterOrder` in `clusters/index.ts`.
4. Put it in scope: in a mode or sub-mode in `modeConfig`, or in a fixed table's `clusters` in `tableViews` (`views.ts`).

### 7.4 Add a mode or sub-mode

1. Add the mode to `ViewMode` and to `modeConfig`, either with `clusters` or with `allLabel` and `subModes`.
2. Add it to the table's `modes` in `tableViews` (the first mode is the default).

A sub-mode is only a new key in a mode's `subModes`. "All" is added for you and puts every sub-mode's clusters in scope.

### 7.5 Make a column differ by table

Use `byTable(table, …)` inside the cluster for the header, field, markers or edit rule. For an edit rule shared by many columns, change `clusterContext`.

### 7.6 Use a real backend

Remove `columnLayoutApiInterceptor` and `ColumnLayoutStore`, and serve the three endpoints in §6.4, storing layouts by the session's user and key. `ColumnLayoutService` needs no change: the app's SSO interceptor or session cookie authenticates its requests. If the app can switch accounts without a page reload, clear the service's cache on sign-out.

## 8. Rules

- **Column ids are unique across all clusters.** Saved layouts match by `colId`.
- **Group ids end in `Group`.** If a group and a column share an id, AG Grid renames the column (`freightCost` → `freightCost_1`) and its saved state stops applying.
- **Never change `columnDefs` for a view.** Change scope in `views.ts`; let `applyColumnState` do the rest.
- **Only in-scope columns are saved.** A layout key that several views share would let a narrower view overwrite a wider view's columns.
- **Our own column changes must run inside `applying = true`**, or they are saved as user changes.
- **New user-change sources** (a new AG Grid event source) must be added to `USER_SOURCES` to be saved.

## 9. Tests

- `clusters/shared/marker-rules.spec.ts` covers the shared marker rules.
- `column-layout.service.spec.ts` covers the service: no user is sent, one load per table, a failed load, a waiting change winning over the server copy, the save delay, the `pagehide` send, and reset.

`buildColumnState`, `savedColumns`, `layoutKey`, `clustersInScope` and `resolveView` are pure functions and not tested yet.
