import { signal } from '@angular/core';
import { FilterModel, GridApi } from 'ag-grid-community';
import { RowIdentity, TableModel } from '../model/table-model';
export class TableProjection<R extends RowIdentity> {
  private readonly faultState = signal('');
  readonly fault = this.faultState.asReadonly();
  private projected = new Map<string, R>();
  private api: GridApi<R> | undefined;
  constructor(readonly model: TableModel<R>) {}
  connect(api: GridApi<R>): void {
    this.api = api;
    this.sync();
  }
  disconnect(): void {
    this.api = undefined;
    this.projected.clear();
  }
  sync(): void {
    const api = this.api;
    if (!api || api.isDestroyed()) return;
    const rows = this.model.rows();
    const changed = rows.filter((row) => this.projected.get(row.id) !== row);
    try {
      api.setGridOption('rowData', [...rows]);
      api.refreshCells({
        rowNodes: changed.flatMap((row) => {
          const node = api.getRowNode(row.id);
          return node ? [node] : [];
        }),
        force: true,
      });
      this.projected = new Map(rows.map((row) => [row.id, row]));
      this.faultState.set('');
    } catch (error) {
      this.faultState.set(error instanceof Error ? error.message : 'Grid projection unavailable');
    }
  }
  sort(columnId: string): void {
    this.api?.applyColumnState({
      state: [{ colId: columnId, sort: 'asc' }],
      defaultState: { sort: null },
    });
  }
  filter(model: FilterModel | null): void {
    this.api?.setFilterModel(model);
  }
  group(columnId: string, enabled: boolean): void {
    this.api?.applyColumnState({
      state: [{ colId: columnId, rowGroup: enabled }],
      defaultState: { rowGroup: false },
    });
  }
  focus(rowId: string, columnId: string): void {
    const node = this.api?.getRowNode(rowId);
    if (node?.rowIndex != null) {
      this.api?.ensureIndexVisible(node.rowIndex);
      this.api?.setFocusedCell(node.rowIndex, columnId);
    }
  }
}
