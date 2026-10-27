import type { ColDef, ColGroupDef } from 'ag-grid-community';

export type TableType = 'bom' | 'inbound' | 'outbound';
export type ViewMode =
  'transport' | 'packaging' | 'daysOnHand' | 'capitalEmployed' | 'replenishment';
export type ClusterId =
  | 'core'
  | 'bomStructure'
  | 'freightCost'
  | 'transportLeadTime'
  | 'emptyReturn'
  | 'packDimensions'
  | 'packConcept'
  | 'stockCoverage'
  | 'inventoryValue'
  | 'replenishmentTime';

export interface ViewState {
  readonly mode: ViewMode;
  readonly subMode?: string;
}

export interface RowData {
  readonly id: string;
  readonly path: readonly string[];
  /** Has rows below it in the tree; set when the seed is built. */
  readonly parent: boolean;
  readonly partCode: string;
  readonly partName: string;
  readonly unit: string;
  readonly level: number;
  readonly quantity: number;
  readonly shippedQuantity: number;
  readonly shipmentStatus: 'open' | 'shipped';
  readonly transportMode: string;
  readonly freightRate: number;
  readonly transitDays: number;
  readonly carrier: string;
  readonly emptyReturnDays: number;
  readonly emptyReturnCost: number;
  readonly packSize: number;
  readonly packWeight: number;
  readonly packDimensions: string;
  readonly packConcept: string;
  readonly packType: string;
  readonly stockOnHand: number;
  readonly dailyUsage: number;
  readonly safetyStock: number;
  readonly unitCost: number;
  readonly capitalRate: number;
  readonly replenishmentDays: number;
  readonly emptiesTracked: boolean;
  readonly packNotes: string;
  /** The planning system sets the replenishment time. */
  readonly autoReorder: boolean;
  /** The row as it was created; an editable field that differs from it was edited by a user. */
  readonly original: RowRecord;
}

/** One record as the backend sends it: a row without its original. */
export type RowRecord = Omit<RowData, 'original'>;

/** What a table loads: each row's active record, and its record as it was created. */
export interface TableRecords {
  readonly active: readonly RowRecord[];
  readonly original: readonly RowRecord[];
}

/** One saved column: array order is column order. */
export interface SavedColumn {
  readonly colId: string;
  readonly hide: boolean;
  readonly width?: number;
}

export type Col = ColDef<RowData>;
export type Group = ColGroupDef<RowData>;
export type ColNode = Col | Group;

export const isGroup = (node: ColNode): node is Group => 'children' in node;

/** All leaf column ids under a node, through nested group headers. */
export const leafIds = (node: ColNode): string[] =>
  isGroup(node) ? node.children.flatMap((child) => leafIds(child as ColNode)) : [node.colId!];
