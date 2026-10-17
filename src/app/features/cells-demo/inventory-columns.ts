import { Validators } from '@angular/forms';
import type { ColDef } from 'ag-grid-community';
import {
  DialogCell,
  DropdownCell,
  FieldEditor,
  NumberCell,
  ToggleCell,
  PopoverCell,
  TextCell,
  withPlaceholder,
  type DialogCellParams,
  type DropdownCellParams,
  type FieldEditorData,
  type NumberCellParams,
  type PopoverCellParams,
  type TextCellParams,
  type ToggleCellParams,
} from '@cells';
import { ReorderCell, type ReorderCellParams } from './reorder-cell';
import { ItemDetailsEditor, type ItemDetailsData, type ItemDraft } from './item-details-editor';
import type { InventoryPersistence } from './inventory-persistence';
import type { Category, Item } from './inventory.model';

type P = InventoryPersistence;
type QtyEditor = FieldEditorData<Item, number>;
type TextEditor = FieldEditorData<Item, string>;

const unlessApproved = ({ row }: { row: Item }) =>
  row.approved ? 'Approved items are locked' : true;

const EURO: NumberCellParams<Item>['number'] = { locale: 'en-US', decimals: 2, unit: '€' };

export function inventoryColumns(): ColDef<Item>[] {
  return [
    { field: 'sku', headerName: 'SKU', width: 110, pinned: 'left' },
    {
      field: 'name',
      headerName: 'Name',
      width: 200,
      cellRenderer: PopoverCell,
      cellRendererParams: {
        editable: unlessApproved,
        markers: { warning: { when: ({ value }) => !value, tooltip: 'Name is missing' } },
        editor: {
          component: FieldEditor<Item, string>,
          data: () => ({
            label: 'Name',
            mode: 'text',
            validators: [Validators.required, Validators.maxLength(60)],
          }),
        },
        popover: { title: 'Edit name', width: 320 },
      } satisfies PopoverCellParams<Item, string, P, TextEditor>,
    },
    {
      field: 'qty',
      headerName: 'Quantity',
      width: 150,
      cellClass: 'cells-align-end',
      ...withPlaceholder<Item, number>({
        value: (item) => item.qty,
        placeholder: (qty, item) => (item.discontinued ? 'NA' : qty == null ? '-' : null),
        renderer: PopoverCell,
        params: {
          format: (qty) => `${qty} pcs`,
          editable: unlessApproved,
          editor: {
            component: FieldEditor<Item, number>,
            data: () => ({ label: 'Quantity', mode: 'number', validators: [Validators.min(0)] }),
          },
          popover: { title: 'Edit quantity', width: 280 },
        } satisfies PopoverCellParams<Item, number, P, QtyEditor>,
      }),
    },
    {
      field: 'stockValue',
      headerName: 'Stock value',
      width: 150,
      cellClass: 'cells-align-end',
      cellRenderer: NumberCell,
      cellRendererParams: {
        number: EURO,
        highlighted: ({ value }) => (value ?? 0) > 20_000,
        markers: { systemGenerated: { when: true, tooltip: 'Calculated from quantity and price' } },
      } satisfies NumberCellParams<Item>,
    },
    {
      field: 'category',
      headerName: 'Category',
      width: 160,
      cellRenderer: DropdownCell,
      cellRendererParams: {
        options: [
          { value: 'hardware', label: 'Hardware' },
          { value: 'tools', label: 'Tools' },
          { value: 'fasteners', label: 'Fasteners' },
        ],
        placeholder: 'Choose category',
        editable: unlessApproved,
      } satisfies DropdownCellParams<Item, Category, P>,
    },
    {
      field: 'active',
      headerName: 'Active',
      width: 100,
      cellRenderer: ToggleCell,
      cellRendererParams: {
        editable: unlessApproved,
        tooltip: ({ value }) => (value ? 'Sold in the shop' : 'Hidden from the shop'),
      } satisfies ToggleCellParams<Item, P>,
    },
    {
      colId: 'reorder',
      headerName: 'Reorder',
      width: 200,
      valueGetter: () => null,
      cellRenderer: ReorderCell,
      cellRendererParams: {
        toggle: {
          editable: unlessApproved,
          command: (reorder, cell) => ({
            changes: [{ rowId: cell.rowId, field: 'reorder', value: reorder }],
          }),
        },
        level: {
          editable: unlessApproved,
          command: (level, cell) => ({
            changes: [{ rowId: cell.rowId, field: 'reorderLevel', value: level }],
          }),
        },
      } satisfies ReorderCellParams,
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 200,
      cellRenderer: DialogCell,
      cellRendererParams: {
        format: (notes) => notes?.split('\n')[0] ?? '',
        tooltip: ({ value }) => value || null,
        editor: {
          component: FieldEditor<Item, string>,
          data: () => ({ label: 'Notes', mode: 'multiline' }),
        },
        dialog: { title: 'Edit notes', width: 480 },
      } satisfies DialogCellParams<Item, string, P, TextEditor, 'save', string | null>,
    },
    {
      colId: 'details',
      headerName: 'Details',
      width: 100,
      valueGetter: () => null,
      cellRenderer: DialogCell,
      cellRendererParams: {
        format: () => '',
        editor: { component: ItemDetailsEditor },
        dialog: { title: 'Item details', width: 420 },
        // One command changes several fields.
        command: (draft, cell) => ({
          changes: (Object.keys(draft) as (keyof ItemDraft)[]).map((field) => ({
            rowId: cell.rowId,
            field,
            value: draft[field],
          })),
        }),
      } satisfies DialogCellParams<Item, null, P, ItemDetailsData, 'save', ItemDraft>,
    },
    {
      colId: 'approved',
      headerName: 'Status',
      width: 120,
      valueGetter: ({ data }) => (data?.approved ? 'Approved' : 'Pending'),
      cellRenderer: TextCell,
      cellRendererParams: {
        muted: ({ value }) => value === 'Pending',
      } satisfies TextCellParams<Item>,
    },
  ];
}

/** The read-only summary grid on the same session. */
export function summaryColumns(): ColDef<Item>[] {
  return [
    { field: 'sku', headerName: 'SKU', width: 110 },
    { field: 'name', headerName: 'Name', flex: 1 },
    {
      field: 'stockValue',
      headerName: 'Stock value',
      width: 150,
      cellClass: 'cells-align-end',
      cellRenderer: NumberCell,
      cellRendererParams: { number: EURO } satisfies NumberCellParams<Item>,
    },
  ];
}
