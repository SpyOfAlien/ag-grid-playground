// Read-only column builders, number formats and helpers every cluster uses.
import {
  NumberCell,
  TextCell,
  type CellColumnContext,
  type Markers,
  type NumberCellParams,
  type NumberFormat,
  type TextCellParams,
} from '@cells';
import type { Col, RowData, RowRecord } from '../../tree-table.model';

export type Field = keyof RowData & string;
/** Fields an edit can change: not the row's identity, its place in the tree or its original. */
export type EditableField = Exclude<keyof RowRecord, 'id' | 'path' | 'parent'>;
export type Depends = CellColumnContext<RowData>;

/** A number column's display: its format and the rules of each marker kind. */
export interface NumberDisplay {
  readonly format: NumberFormat<RowData>;
  readonly markers?: Markers<RowData, number>;
}

export const EURO: NumberFormat<RowData> = { locale: 'en-US', decimals: 2, unit: '€' };
export const WHOLE: NumberFormat<RowData> = { locale: 'en-US', decimals: 0 };
export const DAYS: NumberFormat<RowData> = { locale: 'en-US', decimals: 1, unit: 'd' };

/** A row with no rows below it; parents only sum or group. */
export const leaf = (row: RowData) => !row.parent;

export const text = (
  colId: Field,
  headerName: string,
  markers: Markers<RowData, string> = {},
  extra: Col = {},
): Col => ({
  colId,
  field: colId,
  headerName,
  cellRenderer: TextCell,
  cellRendererParams: { markers } satisfies TextCellParams<RowData>,
  ...extra,
});

export const number = (
  colId: string,
  headerName: string,
  { format, markers }: NumberDisplay,
  extra: Col = {},
): Col => ({
  colId,
  field: colId as Field,
  headerName,
  cellClass: 'cells-align-end',
  cellRenderer: NumberCell,
  cellRendererParams: {
    markers,
    content: { number: format },
  } satisfies NumberCellParams<RowData>,
  ...extra,
});

/** Computed by the system from other fields: no field of its own, and marked as such. */
export const computedNumber = (
  colId: string,
  headerName: string,
  valueGetter: (row: RowData) => number | null,
  how: string,
  { format, markers = {} }: NumberDisplay,
  extra: Col = {},
): Col => ({
  ...number(
    colId,
    headerName,
    {
      format,
      markers: {
        ...markers,
        systemGenerated: [`Calculated: ${how}`, ...(markers.systemGenerated ?? [])],
      },
    },
    extra,
  ),
  field: undefined,
  valueGetter: ({ data }: { data?: RowData }) => (data ? valueGetter(data) : null),
});
