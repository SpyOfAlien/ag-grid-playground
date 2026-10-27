> **Original design reference.** This is the first design for the tree tables, kept for its reasoning; its code is not kept in sync. For the code as it is now, see [tree-table-column-layouts.md](../tree-table-column-layouts.md).

AG Grid Tree Tables – Final Solution
Angular + AG Grid Enterprise. Tables: BOM, inbound, outbound.
Structure: table → mode → sub-mode → clusters → columns
• Column definitions are built once per table and never change.
• Mode / sub-mode only decides which clusters are in scope.
• Inside scope, each column has its own hide state: its initialHide default, then the user's saved choice from the columns tool panel.
• Saved per user + table + mode + sub-mode: hide, width, order (order stays inside its parent group via marryChildren).
• Filters, sorting and selection are never saved and never reset on view switch.
• Later, each numbered section can move to the folder shown in its header.
Full code (one file, in reading order)
// =====================================================================
// tree-table.ts
// =====================================================================
import { Component, Injectable, computed, effect, inject, input } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AgGridAngular } from 'ag-grid-angular';
import {
ColDef, ColGroupDef, ColumnState, ColumnMovedEvent, ColumnResizedEvent, ColumnVisibleEvent,
EditableCallbackParams, GetRowIdParams, GridApi, GridReadyEvent, IColumnToolPanel,
ITooltipParams, SideBarDef, ValueGetterParams,
} from 'ag-grid-community';
import { Observable, Subject, debounceTime, map } from 'rxjs';
import { environment } from '../environments/environment';

// =====================================================================
// 1. TYPES core/types.ts
// =====================================================================
export type TableType = 'bom' | 'inbound' | 'outbound';
export type ViewMode = 'transport' | 'packaging' | 'daysOnHand' | 'capitalEmployed' | 'replenishment';
export type ClusterId =
| 'core' | 'bomStructure'
| 'freightCost' | 'transportLeadTime' | 'emptyReturn'
| 'packDimensions' | 'packConcept'
| 'stockCoverage' | 'inventoryValue' | 'replenishmentTime';

export interface GridContext { tableType: TableType; }
export interface ViewState { mode: ViewMode; subMode?: string; }

export interface RowData {
id: string;
path: string[];
partCode: string;
partName: string;
unit?: string; level?: number;
quantity?: number; shippedQuantity?: number; shipmentStatus?: string;
transportMode?: string; freightRate?: number; transitDays?: number; carrier?: string;
emptyReturnDays?: number; emptyReturnCost?: number;
packSize?: number; packWeight?: number; packDimensions?: string; packConcept?: string; packType?: string;
stockOnHand?: number; dailyUsage?: number; safetyStock?: number;
unitCost?: number; capitalRate?: number; replenishmentDays?: number;
}

type Col = ColDef<RowData>;
type Group = ColGroupDef<RowData>;
type ColNode = Col | Group;
type VG = ValueGetterParams<RowData>;
type TP = ITooltipParams<RowData>;
type EP = EditableCallbackParams<RowData>;

const isGroup = (n: ColNode): n is Group => 'children' in n;

/** All leaf column ids under a node (works with nested group headers). */
export const leafIds = (n: ColNode): string[] =>
isGroup(n) ? n.children.flatMap((c) => leafIds(c as ColNode)) : [n.colId!];

// =====================================================================
// 2. byTable – pick a function per table, fall back to default
// core/byTable.ts
// =====================================================================
const isDev = !environment.production;
const warned = new Set<string>();

/** byTable(defaultFn, { outbound: outboundFn }) – works for any AG Grid callback. */
export function byTable<P extends { context?: GridContext }, R>(
fallback: (params: P) => R,
overrides: Partial<Record<TableType, (params: P) => R>> = {},
label?: string
): (params: P) => R {
return (params: P): R => {
const table = params.context?.tableType;
if (isDev && !table) {
const key = label ?? fallback.name ?? 'anonymous';
if (!warned.has(key)) {
warned.add(key);
console.warn(`[byTable] Missing context.tableType for "${key}". Using fallback.`);
}
}
return ((table && overrides[table]) || fallback)(params);
};
}

// =====================================================================
// 3. SHARED LOGIC – used by more than one cluster shared/
// =====================================================================
export const activeQuantity = byTable(
(p: VG) => p.data?.quantity ?? 0,
{ outbound: (p: VG) => p.data?.shippedQuantity ?? 0 },
'shared.activeQuantity'
);
export const isLeafRow = (p: EP) => !p.node.allChildrenCount;

// =====================================================================
// 4. CLUSTERS – each owns its getters, warnings, editable, columns
// Folder per cluster: clusters/<name>/ colIds unique across ALL
// =====================================================================

// --- clusters/core/ (always in scope) --------------------------------
const coreEditable = {
quantity: byTable(isLeafRow, {
outbound: (p: EP) => isLeafRow(p) && p.data?.shipmentStatus !== 'shipped',
}, 'core.quantity.editable'),
};
const coreCluster: Group = {
groupId: 'core', headerName: 'Item', marryChildren: true,
children: [
{ colId: 'quantity', headerName: 'Quantity', valueGetter: activeQuantity, editable: coreEditable.quantity },
{ colId: 'unit', field: 'unit', headerName: 'Unit', initialHide: true },
],
};

// --- clusters/bom-structure/ (BOM only) ------------------------------
const bomStructureCluster: Group = {
groupId: 'bomStructure', headerName: 'Structure', marryChildren: true,
children: [
{ colId: 'level', field: 'level', headerName: 'Level' },
{ colId: 'partCode', field: 'partCode', headerName: 'Part code' },
],
};

// --- clusters/freight-cost/ ------------------------------------------
const freightGetters = {
cost: (p: VG) => (p.data?.freightRate ?? 0) * activeQuantity(p),
costPerUnit: (p: VG) => p.data?.freightRate ?? 0,
};
const freightWarnings = {
cost: byTable(
(p: TP) => ((p.value as number) > 10_000 ? 'Freight cost unusually high' : undefined),
{ outbound: (p: TP) => ((p.value as number) > 5_000 ? 'Outbound freight above budget' : undefined) },
'freight.cost.warning'
),
};
const freightCostCluster: Group = {
groupId: 'freightCost', headerName: 'Freight', marryChildren: true,
children: [
{ colId: 'transportMode', field: 'transportMode', headerName: 'Mode' },
{ colId: 'freightCost', headerName: 'Freight cost', valueGetter: freightGetters.cost, tooltipValueGetter: freightWarnings.cost },
{ colId: 'freightCostPerUnit', headerName: 'Cost / unit', valueGetter: freightGetters.costPerUnit, initialHide: true },
],
};

// --- clusters/transport-lead-time/ -----------------------------------
const transportLeadTimeCluster: Group = {
groupId: 'transportLeadTime', headerName: 'Lead time', marryChildren: true,
children: [
{ colId: 'transitDays', field: 'transitDays', headerName: 'Transit (days)' },
{ colId: 'carrier', field: 'carrier', headerName: 'Carrier' },
],
};

// --- clusters/empty-return/ ------------------------------------------
const emptyWarnings = {
days: (p: TP) => ((p.value as number) > 30 ? 'Empties take more than 30 days to return' : undefined),
};
const emptyReturnCluster: Group = {
groupId: 'emptyReturn', headerName: 'Empties', marryChildren: true,
children: [
{ colId: 'emptyReturnDays', field: 'emptyReturnDays', headerName: 'Return (days)', tooltipValueGetter: emptyWarnings.days },
{ colId: 'emptyReturnCost', field: 'emptyReturnCost', headerName: 'Return cost' },
],
};

// --- clusters/pack-dimensions/ ---------------------------------------
const packDimensionsCluster: Group = {
groupId: 'packDimensions', headerName: 'Packaging detail', marryChildren: true,
children: [
{ colId: 'packSize', field: 'packSize', headerName: 'Pack size' },
{ colId: 'packWeight', field: 'packWeight', headerName: 'Weight' },
{ colId: 'packDimensions', field: 'packDimensions', headerName: 'Dimensions', initialHide: true },
],
};

// --- clusters/pack-concept/ ------------------------------------------
const packConceptCluster: Group = {
groupId: 'packConcept', headerName: 'Packaging concept', marryChildren: true,
children: [
{ colId: 'packConcept', field: 'packConcept', headerName: 'Concept' },
{ colId: 'packType', field: 'packType', headerName: 'Pack type' },
],
};

// --- clusters/stock-coverage/ (days on hand) -------------------------
const coverageGetters = {
daysOnHand: (p: VG) => {
const usage = p.data?.dailyUsage ?? 0;
return usage > 0 ? (p.data?.stockOnHand ?? 0) / usage : null;
},
};
const coverageWarnings = {
daysOnHand: byTable(
(p: TP) => {
const doh = p.value as number | null;
return doh !== null && doh < (p.data?.replenishmentDays ?? 0) ? 'Stock runs out before replenishment arrives' : undefined;
},
{ outbound: (p: TP) => (p.value !== null && (p.value as number) < 3 ? 'Less than 3 days of stock' : undefined) },
'coverage.doh.warning'
),
};
const stockCoverageCluster: Group = {
groupId: 'stockCoverage', headerName: 'Days on hand', marryChildren: true,
children: [
{ colId: 'stockOnHand', field: 'stockOnHand', headerName: 'Stock' },
{ colId: 'daysOnHand', headerName: 'DOH', valueGetter: coverageGetters.daysOnHand, tooltipValueGetter: coverageWarnings.daysOnHand },
{ colId: 'safetyStock', field: 'safetyStock', headerName: 'Safety stock', initialHide: true },
],
};

// --- clusters/inventory-value/ (capital employed) --------------------
const capitalGetters = {
inventoryValue: (p: VG) => (p.data?.stockOnHand ?? 0) * (p.data?.unitCost ?? 0),
capitalCostPerYear: (p: VG) => capitalGetters.inventoryValue(p) * (p.data?.capitalRate ?? 0),
};
const inventoryValueCluster: Group = {
groupId: 'inventoryValue', headerName: 'Capital employed', marryChildren: true,
children: [
{ colId: 'unitCost', field: 'unitCost', headerName: 'Unit cost' },
{ colId: 'inventoryValue', headerName: 'Inventory value', valueGetter: capitalGetters.inventoryValue },
{ colId: 'capitalCostPerYear', headerName: 'Capital cost / year', valueGetter: capitalGetters.capitalCostPerYear, initialHide: true },
],
};

// --- clusters/replenishment-time/ ------------------------------------
const replenishmentTimeCluster: Group = {
groupId: 'replenishmentTime', headerName: 'Replenishment', marryChildren: true,
children: [{ colId: 'replenishmentDays', field: 'replenishmentDays', headerName: 'Replenishment (days)' }],
};

// =====================================================================
// 5. CLUSTER REGISTRY clusters/index.ts
// =====================================================================
export const clusters: Record<ClusterId, Group> = {
core: coreCluster,
bomStructure: bomStructureCluster,
freightCost: freightCostCluster,
transportLeadTime: transportLeadTimeCluster,
emptyReturn: emptyReturnCluster,
packDimensions: packDimensionsCluster,
packConcept: packConceptCluster,
stockCoverage: stockCoverageCluster,
inventoryValue: inventoryValueCluster,
replenishmentTime: replenishmentTimeCluster,
};

export const clusterOrder: ClusterId[] = [
'core', 'bomStructure',
'freightCost', 'transportLeadTime', 'emptyReturn',
'packDimensions', 'packConcept',
'stockCoverage', 'inventoryValue', 'replenishmentTime',
];

/** Each column's own default hide (initialHide) and width. */
const columnDefaults = new Map<string, { hide: boolean; width?: number }>();
const collectDefaults = (n: ColNode): void => {
if (isGroup(n)) return n.children.forEach((c) => collectDefaults(c as ColNode));
columnDefaults.set(n.colId!, { hide: !!n.initialHide, width: n.initialWidth ?? n.width });
};
Object.values(clusters).forEach(collectDefaults);

// =====================================================================
// 6. VIEWS – modes, sub-modes, per table core/views.ts
// =====================================================================
export const ALL = 'all';
const ALWAYS_IN_SCOPE: ClusterId[] = ['core'];

interface SubModeConfig { label: string; clusters: ClusterId[]; }

type ModeConfig =
| { label: string; clusters: ClusterId[]; subModes?: undefined }
| { label: string; allLabel: string; subModes: Record<string, SubModeConfig>; clusters?: undefined };

export const modeConfig: Record<ViewMode, ModeConfig> = {
transport: {
label: 'Transportation',
allLabel: 'All', // "All" = every sub-mode's clusters, built automatically
subModes: {
transport: { label: 'Transportation', clusters: ['freightCost', 'transportLeadTime'] },
empties: { label: 'Empties', clusters: ['emptyReturn'] },
},
},
packaging: {
label: 'Packaging',
allLabel: 'All',
subModes: {
detail: { label: 'Detail', clusters: ['packDimensions'] },
concept: { label: 'Concept', clusters: ['packConcept'] },
},
},
daysOnHand: { label: 'Days on hand', clusters: ['stockCoverage'] },
capitalEmployed: { label: 'Capital employed', clusters: ['inventoryValue'] },
replenishment: { label: 'Replenishment time', clusters: ['replenishmentTime'] },
};

type TableViewConfig =
| { kind: 'fixed'; clusters: ClusterId[] } // no modes (BOM)
| { kind: 'modes'; modes: ViewMode[] }; // first = default

export const tableViews: Record<TableType, TableViewConfig> = {
bom: { kind: 'fixed', clusters: ['bomStructure', 'stockCoverage', 'replenishmentTime', 'packDimensions'] },
inbound: { kind: 'modes', modes: ['transport', 'packaging', 'daysOnHand', 'capitalEmployed', 'replenishment'] },
outbound: { kind: 'modes', modes: ['transport', 'packaging', 'daysOnHand', 'capitalEmployed', 'replenishment'] },
};

export const hasModes = (table: TableType) => tableViews[table].kind === 'modes';

/** Sub-mode buttons for a mode ("All" first). Empty if none. */
export function subModeOptions(mode: ViewMode): { key: string; label: string }[] {
const cfg = modeConfig[mode];
if (!cfg.subModes) return [];
return [{ key: ALL, label: cfg.allLabel }, ...Object.entries(cfg.subModes).map(([key, s]) => ({ key, label: s.label }))];
}

// =====================================================================
// 7. SCOPE – which clusters a view uses core/scope.ts
// =====================================================================

/** Fills in default mode / sub-mode. undefined for fixed tables (BOM). */
export function resolveView(table: TableType, view?: Partial<ViewState>): ViewState | undefined {
const tv = tableViews[table];
if (tv.kind === 'fixed') return undefined;
const mode = view?.mode && tv.modes.includes(view.mode) ? view.mode : tv.modes[0];
const cfg = modeConfig[mode];
if (!cfg.subModes) return { mode };
const valid = view?.subMode === ALL || (view?.subMode && cfg.subModes[view.subMode]);
return { mode, subMode: valid ? view!.subMode : ALL };
}

/** Clusters in scope for one view, in display order. */
export function clustersInScope(table: TableType, view?: ViewState): ClusterId[] {
const tv = tableViews[table];
let ids: ClusterId[];
if (tv.kind === 'fixed') {
ids = tv.clusters;
} else {
const v = resolveView(table, view)!;
const cfg = modeConfig[v.mode];
if (!cfg.subModes) ids = cfg.clusters;
else if (v.subMode === ALL) ids = Object.values(cfg.subModes).flatMap((s) => s.clusters);
else ids = cfg.subModes[v.subMode!].clusters;
}
const set = new Set<ClusterId>([...ALWAYS_IN_SCOPE, ...ids]);
return clusterOrder.filter((id) => set.has(id));
}

/** Every cluster a table can ever show (decides which columns EXIST). */
function allClustersForTable(table: TableType): ClusterId[] {
const tv = tableViews[table];
const views: (ViewState | undefined)[] =
tv.kind === 'fixed' ? [undefined]
: tv.modes.map((mode) => (modeConfig[mode].subModes ? { mode, subMode: ALL } : { mode }));
const set = new Set(views.flatMap((v) => clustersInScope(table, v)));
return clusterOrder.filter((id) => set.has(id));
}

export const columnIdsInScope = (table: TableType, view?: ViewState): string[] =>
clustersInScope(table, view).flatMap((id) => leafIds(clusters[id]));

// =====================================================================
// 8. COLUMN DEFS PER TABLE – built once, never change core/columns.ts
// =====================================================================
const columnDefsCache = new Map<TableType, Group[]>();

/** Out-of-scope columns of the default view start hidden (no flash on load). */
const withStartHide = (n: ColNode, inScope: Set<string>): ColNode =>
isGroup(n)
? { ...n, children: n.children.map((c) => withStartHide(c as ColNode, inScope)) }
: { ...n, initialHide: !!n.initialHide || !inScope.has(n.colId!) };

export function columnsByTable(table: TableType): Group[] {
let defs = columnDefsCache.get(table);
if (!defs) {
const inScope = new Set(columnIdsInScope(table, resolveView(table)));
defs = allClustersForTable(table).map((id) => withStartHide(clusters[id], inScope) as Group);
columnDefsCache.set(table, defs);
}
return defs;
}

// =====================================================================
// 9. LAYOUT STATE – what to apply for a view core/layout.ts
// =====================================================================
export interface SavedColumn { colId: string; hide: boolean; width?: number; } // array order = column order

export const layoutKey = (table: TableType, view?: ViewState): string =>
!view ? `${table}:default` : view.subMode ? `${table}:${view.mode}:${view.subMode}` : `${table}:${view.mode}`;

/** In scope: saved hide/width/order, else column defaults. Out of scope: hidden. */
export function buildColumnState(table: TableType, view: ViewState | undefined, saved?: SavedColumn[]): ColumnState[] {
const inScope = columnIdsInScope(table, view);
const inScopeSet = new Set(inScope);
const savedById = new Map((saved ?? []).map((c) => [c.colId, c]));

const ordered = [
...(saved ?? []).map((c) => c.colId).filter((id) => inScopeSet.has(id)),
...inScope.filter((id) => !savedById.has(id)), // columns added after the user saved
];

const inScopeState: ColumnState[] = ordered.map((colId) => {
const s = savedById.get(colId);
const d = columnDefaults.get(colId);
const width = s?.width ?? d?.width;
return { colId, hide: s ? s.hide : d?.hide ?? false, ...(width ? { width } : {}) };
});

const outOfScopeState: ColumnState[] = columnsByTable(table)
.flatMap(leafIds)
.filter((id) => !inScopeSet.has(id))
.map((colId) => ({ colId, hide: true }));

return [...inScopeState, ...outOfScopeState];
}

/** Tool panel shows only the clusters of this view. */
export const toolPanelLayout = (table: TableType, view?: ViewState): Group[] =>
clustersInScope(table, view).map((id) => clusters[id]);

// =====================================================================
// 10. SAVED LAYOUTS – backend, per user core/column-layout.service.ts
// =====================================================================
@Injectable({ providedIn: 'root' })
export class ColumnLayoutService {
private http = inject(HttpClient);
private cache: Record<string, SavedColumn[]> = {};

loadAll(table: TableType): Observable<void> {
return this.http
.get<Record<string, SavedColumn[]>>(`/api/column-layouts/${table}`)
.pipe(map((layouts) => void (this.cache = { ...this.cache, ...layouts })));
}
get(key: string): SavedColumn[] | undefined { return this.cache[key]; }
save(key: string, layout: SavedColumn[]): void {
this.cache[key] = layout;
this.http.put(`/api/column-layouts/${encodeURIComponent(key)}`, layout).subscribe();
}
reset(key: string): Observable<unknown> {
delete this.cache[key];
return this.http.delete(`/api/column-layouts/${encodeURIComponent(key)}`);
}
}

// =====================================================================
// 11. COMPONENT tree-table.component.ts
// =====================================================================
@Component({
selector: 'app-tree-table',
standalone: true,
imports: [AgGridAngular],
template: `     <ag-grid-angular
      class="ag-theme-quartz" style="height: 600px"
      [rowData]="rowData()" [columnDefs]="columnDefs()" [context]="context()"
      [treeData]="true" [getDataPath]="getDataPath" [getRowId]="getRowId"
      [autoGroupColumnDef]="autoGroupColumnDef" [groupDefaultExpanded]="1"
      [sideBar]="sideBar" [maintainColumnOrder]="true" [tooltipShowDelay]="300"
      (gridReady)="onGridReady($event)"
      (toolPanelVisibleChanged)="syncToolPanel()"
      (columnVisible)="onColumnVisible($event)"
      (columnMoved)="onColumnMoved($event)"
      (columnResized)="onColumnResized($event)"
    />
  `,
})
export class TreeTableComponent {
private layouts = inject(ColumnLayoutService);

tableType = input.required<TableType>();
view = input<Partial<ViewState>>(); // ignored for BOM
rowData = input<RowData[]>([]);

context = computed<GridContext>(() => ({ tableType: this.tableType() }));
columnDefs = computed(() => columnsByTable(this.tableType())); // never changes on view switch
resolvedView = computed(() => resolveView(this.tableType(), this.view()));

autoGroupColumnDef: Col = { headerName: 'Part', field: 'partName', minWidth: 260 };
getDataPath = (row: RowData) => row.path;
getRowId = (p: GetRowIdParams<RowData>) => p.data.id;
sideBar: SideBarDef = {
toolPanels: [{
id: 'columns', labelDefault: 'Columns', labelKey: 'columns', iconKey: 'columns',
toolPanel: 'agColumnsToolPanel',
toolPanelParams: { suppressRowGroups: true, suppressValues: true, suppressPivots: true, suppressPivotMode: true },
}],
};

private api?: GridApi<RowData>;
private applying = false; // true while OUR code changes columns → don't save
private save$ = new Subject<void>();

constructor() {
effect(() => {
const view = this.resolvedView();
if (this.api) this.applyLayout(view); // grid is NOT recreated
});
this.save$.pipe(debounceTime(500)).subscribe(() => this.saveLayout());
}

onGridReady(e: GridReadyEvent<RowData>) {
this.api = e.api;
this.layouts.loadAll(this.tableType()).subscribe(() => this.applyLayout(this.resolvedView()));
}

private applyLayout(view?: ViewState) {
if (!this.api) return;
const saved = this.layouts.get(layoutKey(this.tableType(), view));
this.applying = true;
this.api.applyColumnState({ state: buildColumnState(this.tableType(), view, saved), applyOrder: true });
this.syncToolPanel();
this.applying = false;
}

/** Tool panel shows only this view's clusters (re-run when it opens; it's lazy). */
syncToolPanel() {
const panel = this.api?.getToolPanelInstance('columns') as IColumnToolPanel | undefined;
panel?.setColumnLayout(toolPanelLayout(this.tableType(), this.resolvedView()));
}

/** Saves only in-scope columns: hide, width, order. */
private saveLayout() {
if (!this.api) return;
const view = this.resolvedView();
const inScope = new Set(columnIdsInScope(this.tableType(), view));
const layout: SavedColumn[] = this.api
.getColumnState()
.filter((c) => inScope.has(c.colId))
.map((c) => ({ colId: c.colId, hide: !!c.hide, ...(c.width ? { width: c.width } : {}) }));
this.layouts.save(layoutKey(this.tableType(), view), layout);
}

private isUserChange(source: string) {
return !this.applying && source !== 'api' && source !== 'gridOptionsChanged';
}
onColumnVisible(e: ColumnVisibleEvent) { if (this.isUserChange(e.source)) this.save$.next(); }
onColumnMoved(e: ColumnMovedEvent) { if (e.finished && this.isUserChange(e.source)) this.save$.next(); }
onColumnResized(e: ColumnResizedEvent) { if (e.finished && this.isUserChange(e.source)) this.save$.next(); }

/** "Reset to default" for the current view. */
resetLayout() {
const view = this.resolvedView();
this.layouts.reset(layoutKey(this.tableType(), view)).subscribe(() => this.applyLayout(view));
}
}

// =====================================================================
// USAGE
// =====================================================================
// <app-tree-table tableType="bom" [rowData]="bomRows()" />
// <app-tree-table tableType="inbound" [view]="{ mode: 'transport', subMode: 'empties' }" [rowData]="inboundRows()" />
// <app-tree-table tableType="outbound" [view]="outboundView()" [rowData]="outboundRows()" />
// Mode buttons: tableViews[table].modes (only when hasModes(table))
// Sub-mode buttons: subModeOptions(mode) → "All", then each sub-mode
Notes
• Tree data and the columns tool panel need AG Grid Enterprise.
• Cluster names, fields, getters and API URLs are placeholders.
• Every colId must be unique across all clusters; saved layouts match by id. Never rename one without a migration.
• Columns added after a user saved go at the end of their group for that user.
• applying is a guard flag: it stops saves triggered by our own layout changes.
