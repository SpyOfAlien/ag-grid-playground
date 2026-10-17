import {
  AllCommunityModule,
  createGrid,
  ModuleRegistry,
  type GridApi,
  type ICellRendererComp,
  type ICellRendererParams,
} from 'ag-grid-community';
import { withEmptyState } from './empty-state';

ModuleRegistry.registerModules([AllCommunityModule]);

interface Item {
  readonly sku: string;
  readonly qty: number | null;
  readonly discontinued: boolean;
}

class QtyRenderer implements ICellRendererComp<Item> {
  private readonly gui = document.createElement('b');
  init(params: ICellRendererParams<Item> & { unit: string }): void {
    this.gui.textContent = `${params.value} ${params.unit}`;
  }
  getGui(): HTMLElement {
    return this.gui;
  }
  refresh(): boolean {
    return false;
  }
}

function mount(rows: Item[]) {
  return new Promise<GridApi<Item>>((ready) => {
    const api = createGrid<Item>(document.body.appendChild(document.createElement('div')), {
      rowData: rows,
      getRowId: ({ data }) => data.sku,
      domLayout: 'autoHeight',
      columnDefs: [
        {
          colId: 'qty',
          ...withEmptyState<Item, number>({
            value: (item) => item.qty,
            emptyState: (qty, item) =>
              item.discontinued ? 'NA' : qty == null || qty === 0 ? '-' : null,
            renderer: QtyRenderer,
            params: { unit: 'pcs' },
          }),
        },
      ],
      onGridReady: () => ready(api),
    });
  });
}

describe('withEmptyState', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('uses the empty state as the cell value and skips the renderer', async () => {
    const api = await mount([
      { sku: 'A-1', qty: 0, discontinued: false },
      { sku: 'B-2', qty: 4, discontinued: true },
      { sku: 'C-3', qty: 4, discontinued: false },
    ]);
    const value = (id: string) => api.getCellValue({ rowNode: api.getRowNode(id)!, colKey: 'qty' });
    const cell = (id: string) => document.querySelector(`[row-id="${id}"] [col-id="qty"]`);

    expect([value('A-1'), value('B-2'), value('C-3')]).toEqual(['-', 'NA', 4]);
    await vi.waitFor(() => expect(cell('C-3')?.textContent?.trim()).toBe('4 pcs'));
    expect(cell('A-1')?.textContent?.trim()).toBe('-');
    expect(cell('A-1')?.querySelector('b')).toBeNull();
    expect(cell('B-2')?.textContent?.trim()).toBe('NA');
  });
});
