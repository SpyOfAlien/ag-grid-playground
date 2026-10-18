import { Validators } from '@angular/forms';
import type { ColDef } from 'ag-grid-community';
import {
  type CellColumnContext,
  DialogCell,
  DropdownCell,
  FieldEditor,
  formatNumber,
  NumberCell,
  ToggleCell,
  PopoverCell,
  TextCell,
  withEmptyState,
  type DialogCellParams,
  type DropdownCellParams,
  type FieldEditorData,
  type NumberCellParams,
  type NumberFormat,
  type PopoverCellParams,
  type TextCellParams,
  type ToggleCellParams,
} from '@cells';
import { ReorderCell, type ReorderCellParams } from './reorder-cell';
import { ItemDetailsEditor, type ItemDetailsData, type ItemDraft } from './item-details-editor';
import type { InventoryPersistence } from './inventory-persistence';
import { DEMO_TODAY, type Category, type Item, type Supplier } from './inventory.model';

type P = InventoryPersistence;
/** Fields and columns a column's rules depend on besides its own value. */
type Depends = CellColumnContext<Item>;
type NumberEditor = FieldEditorData<Item, number>;
type TextEditor = FieldEditorData<Item, string>;

const unlessApproved = ({ row }: { row: Item }) =>
  row.approved ? 'Approved items are locked' : true;

const EURO: NumberFormat<Item> = { locale: 'en-US', decimals: 2, unit: '€' };

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
      context: { dependsOn: ['approved', 'discontinued'] } satisfies Depends,
      headerName: 'Name',
      width: 200,
      cellRenderer: PopoverCell,
      cellRendererParams: {
        markers: {
          warning: { when: ({ value }) => !value, tooltip: 'Name is missing' },
          special: { when: ({ row }) => row.discontinued, tooltip: 'Discontinued item' },
        },
        action: {
          allowed: unlessApproved,
          editor: {
            component: FieldEditor<Item, string>,
            data: () => ({
              label: 'Name',
              mode: 'text',
              validators: [Validators.required, Validators.maxLength(60)],
            }),
          },
          popover: { title: 'Edit name', width: 320 },
        },
      } satisfies PopoverCellParams<TextEditor, P>,
    },
    {
      field: 'qty',
      context: { dependsOn: ['approved', 'reorderLevel'] } satisfies Depends,
      headerName: 'Quantity',
      width: 150,
      cellClass: 'cells-align-end',
      ...withEmptyState<Item, number>({
        value: (item) => item.qty,
        emptyState: (qty, item) => (item.discontinued ? 'NA' : qty == null ? '-' : null),
        renderer: PopoverCell,
        params: {
          markers: {
            error: {
              when: ({ row, value }) => (value ?? 0) < row.reorderLevel,
              tooltip: ({ row }) => `Below the reorder level of ${row.reorderLevel}`,
            },
          },
          content: { format: (qty) => `${qty} pcs` },
          action: {
            allowed: unlessApproved,
            editor: {
              component: FieldEditor<Item, number>,
              data: () => ({ label: 'Quantity', mode: 'number', validators: [Validators.min(0)] }),
            },
            popover: { title: 'Edit quantity', width: 280 },
          },
        } satisfies PopoverCellParams<NumberEditor, P>,
      }),
    },
    {
      field: 'stockValue',
      context: { dependsOn: ['qty', 'unitPrice'] } satisfies Depends,
      headerName: 'Stock value',
      width: 150,
      cellClass: 'cells-align-end',
      cellRenderer: NumberCell,
      cellRendererParams: {
        markers: { systemGenerated: { when: true, tooltip: 'Calculated from quantity and price' } },
        content: {
          number: EURO,
          highlighted: ({ value }) => (value ?? 0) > 20_000,
          tooltip: ({ row }) => ({
            html: `<b>${row.qty ?? 0}</b> × ${row.unitPrice.toFixed(2)} €`,
          }),
        },
      } satisfies NumberCellParams<Item>,
    },
    {
      field: 'unitPrice',
      context: { dependsOn: ['approved'] } satisfies Depends,
      headerName: 'Unit price',
      width: 140,
      cellClass: 'cells-align-end',
      cellRenderer: PopoverCell,
      cellRendererParams: {
        content: { format: (price, cell) => formatNumber(EURO, { ...cell, value: price }) },
        action: {
          allowed: unlessApproved,
          editor: {
            component: FieldEditor<Item, number>,
            data: () => ({
              label: 'Unit price (€)',
              mode: 'number',
              validators: [Validators.required, Validators.min(0)],
            }),
          },
          popover: { title: 'Edit unit price', width: 280 },
        },
      } satisfies PopoverCellParams<NumberEditor, P>,
    },
    {
      field: 'supplier',
      context: { dependsOn: ['approved'] } satisfies Depends,
      headerName: 'Supplier',
      width: 190,
      cellRenderer: DropdownCell,
      cellRendererParams: {
        markers: {
          warning: {
            when: ({ value }) => value === 'legacy',
            tooltip: 'Supplier takes no new orders',
          },
        },
        content: { placeholder: 'No supplier' },
        action: {
          allowed: unlessApproved,
          options: [
            { value: 'acme', label: 'Acme Industrial Supplies Ltd.' },
            { value: 'bolt', label: 'Bolt & Nut Co.' },
            { value: 'fixit', label: 'FixIt Wholesale' },
            { value: 'legacy', label: 'Legacy Parts (no new orders)', disabled: true },
          ],
        },
      } satisfies DropdownCellParams<Item, Supplier, P>,
    },
    {
      field: 'location',
      headerName: 'Location',
      width: 140,
      cellRenderer: TextCell,
      cellRendererParams: {
        markers: {
          info: { when: ({ value }) => !!value?.startsWith('Yard'), tooltip: 'Outdoor storage' },
        },
        content: {
          tooltip: ({ value }) =>
            value?.startsWith('Yard') ? 'Outdoor storage, check for weather damage' : null,
        },
        tooltipPosition: 'left',
      } satisfies TextCellParams<Item>,
    },
    {
      field: 'lastCounted',
      headerName: 'Last counted',
      width: 150,
      cellRenderer: TextCell,
      cellRendererParams: {
        markers: { warning: { when: ({ value }) => age(value) > 90, tooltip: 'Recount overdue' } },
        content: {
          format: (date) => (date ? DATE.format(Date.parse(date)) : ''),
          tooltip: ({ value }) => `Counted ${age(value)} days ago`,
          muted: ({ value }) => age(value) > 30,
        },
      } satisfies TextCellParams<Item>,
    },
    {
      field: 'category',
      context: { dependsOn: ['approved'] } satisfies Depends,
      headerName: 'Category',
      width: 160,
      cellRenderer: DropdownCell,
      cellRendererParams: {
        content: { placeholder: 'Choose category' },
        action: {
          allowed: unlessApproved,
          options: [
            { value: 'hardware', label: 'Hardware' },
            { value: 'tools', label: 'Tools' },
            { value: 'fasteners', label: 'Fasteners' },
          ],
        },
      } satisfies DropdownCellParams<Item, Category, P>,
    },
    {
      field: 'active',
      context: { dependsOn: ['approved'] } satisfies Depends,
      headerName: 'Active',
      width: 100,
      cellRenderer: ToggleCell,
      cellRendererParams: {
        action: {
          allowed: unlessApproved,
          tooltip: ({ value }) => (value ? 'Sold in the shop' : 'Hidden from the shop'),
        },
        tooltipPosition: 'right',
      } satisfies ToggleCellParams<Item, P>,
    },
    {
      colId: 'reorder',
      context: { dependsOn: ['approved', 'reorder', 'reorderLevel'] } satisfies Depends,
      headerName: 'Reorder',
      width: 200,
      valueGetter: () => null,
      cellRenderer: ReorderCell,
      cellRendererParams: {
        toggle: {
          allowed: unlessApproved,
          command: {
            method: 'save',
            payload: (reorder, cell) => ({
              changes: [{ rowId: cell.rowId, field: 'reorder', value: reorder }],
            }),
          },
        },
        level: {
          allowed: unlessApproved,
          command: {
            method: 'save',
            payload: (level, cell) => ({
              changes: [{ rowId: cell.rowId, field: 'reorderLevel', value: level }],
            }),
          },
        },
      } satisfies ReorderCellParams,
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 200,
      cellRenderer: DialogCell,
      cellRendererParams: {
        content: {
          format: (notes) => notes?.split('\n')[0] ?? '',
          tooltip: ({ value }) => value || null,
        },
        action: {
          editor: {
            component: FieldEditor<Item, string>,
            data: () => ({ label: 'Notes', mode: 'multiline' }),
          },
          dialog: { title: 'Edit notes', width: 480 },
        },
      } satisfies DialogCellParams<TextEditor, P>,
    },
    {
      colId: 'details',
      headerName: 'Details',
      width: 100,
      valueGetter: () => null,
      cellRenderer: DialogCell,
      cellRendererParams: {
        content: { format: () => '' },
        action: {
          editor: { component: ItemDetailsEditor },
          dialog: { title: 'Item details', width: 420 },
          // One payload changes several fields.
          command: {
            method: 'save',
            payload: (draft, cell) => ({
              changes: (Object.keys(draft) as (keyof ItemDraft)[]).map((field) => ({
                rowId: cell.rowId,
                field,
                value: draft[field],
              })),
            }),
          },
        },
      } satisfies DialogCellParams<ItemDetailsData, P>,
    },
    {
      colId: 'approved',
      headerName: 'Status',
      width: 120,
      valueGetter: ({ data }) => (data?.approved ? 'Approved' : 'Pending'),
      cellRenderer: TextCell,
      cellRendererParams: {
        content: { muted: ({ value }) => value === 'Pending' },
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
      cellRendererParams: { content: { number: EURO } } satisfies NumberCellParams<Item>,
    },
  ];
}
