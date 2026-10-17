import { Validators } from '@angular/forms';
import type { ColDef } from 'ag-grid-community';
import {
  DialogCell,
  DropdownCell,
  FieldEditor,
  formatNumber,
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
import { DEMO_TODAY, type Category, type Item, type Supplier } from './inventory.model';

type P = InventoryPersistence;
type QtyEditor = FieldEditorData<Item, number>;
type TextEditor = FieldEditorData<Item, string>;

const unlessApproved = ({ row }: { row: Item }) =>
  row.approved ? 'Approved items are locked' : true;

const EURO: NumberCellParams<Item>['number'] = { locale: 'en-US', decimals: 2, unit: '€' };

const DATE = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const DAY = 24 * 60 * 60 * 1000;

/** Whole days between an ISO date and the demo's today. */
const age = (date: string | null | undefined) =>
  date ? Math.round((Date.parse(DEMO_TODAY) - Date.parse(date)) / DAY) : 0;

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
        markers: {
          warning: { when: ({ value }) => !value, tooltip: 'Name is missing' },
          special: { when: ({ row }) => row.discontinued, tooltip: 'Discontinued item' },
        },
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
          markers: {
            error: {
              when: ({ row, value }) => (value ?? 0) < row.reorderLevel,
              tooltip: ({ row }) => `Below the reorder level of ${row.reorderLevel}`,
            },
          },
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
        tooltip: ({ row }) => ({
          html: `<b>${row.qty ?? 0}</b> × ${row.unitPrice.toFixed(2)} €`,
        }),
        markers: { systemGenerated: { when: true, tooltip: 'Calculated from quantity and price' } },
      } satisfies NumberCellParams<Item>,
    },
    {
      field: 'unitPrice',
      headerName: 'Unit price',
      width: 140,
      cellClass: 'cells-align-end',
      cellRenderer: PopoverCell,
      cellRendererParams: {
        format: (price, cell) => formatNumber(EURO, { ...cell, value: price }),
        editable: unlessApproved,
        editor: {
          component: FieldEditor<Item, number>,
          data: () => ({
            label: 'Unit price (€)',
            mode: 'number',
            validators: [Validators.required, Validators.min(0)],
          }),
        },
        popover: { title: 'Edit unit price', width: 280 },
      } satisfies PopoverCellParams<Item, number, P, QtyEditor>,
    },
    {
      field: 'supplier',
      headerName: 'Supplier',
      width: 190,
      cellRenderer: DropdownCell,
      cellRendererParams: {
        options: [
          { value: 'acme', label: 'Acme Industrial Supplies Ltd.' },
          { value: 'bolt', label: 'Bolt & Nut Co.' },
          { value: 'fixit', label: 'FixIt Wholesale' },
          { value: 'legacy', label: 'Legacy Parts (no new orders)', disabled: true },
        ],
        placeholder: 'No supplier',
        editable: unlessApproved,
        markers: {
          warning: {
            when: ({ value }) => value === 'legacy',
            tooltip: 'Supplier takes no new orders',
          },
        },
      } satisfies DropdownCellParams<Item, Supplier, P>,
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 140,
      cellRenderer: TextCell,
      cellRendererParams: {
        tooltip: ({ value }) =>
          value?.startsWith('Yard') ? 'Outdoor storage, check for weather damage' : null,
        tooltipPosition: 'left',
        markers: {
          info: { when: ({ value }) => !!value?.startsWith('Yard'), tooltip: 'Outdoor storage' },
        },
      } satisfies TextCellParams<Item>,
    },
    {
      field: 'lastCounted',
      headerName: 'Last counted',
      width: 150,
      cellRenderer: TextCell,
      cellRendererParams: {
        format: (date) => (date ? DATE.format(Date.parse(date)) : ''),
        tooltip: ({ value }) => `Counted ${age(value)} days ago`,
        muted: ({ value }) => age(value) > 30,
        markers: { warning: { when: ({ value }) => age(value) > 90, tooltip: 'Recount overdue' } },
      } satisfies TextCellParams<Item>,
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
        tooltipPosition: 'right',
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
