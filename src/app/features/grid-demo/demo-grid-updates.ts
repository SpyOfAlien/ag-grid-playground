import type { GridApi } from 'ag-grid-community';
import type { DemoRow } from './demo-row.model';
import { DemoEditError } from './demo-persistence.model';

export type DemoClientStrategy = 'transaction' | 'mutation';

/** Private feature implementation. Client tables use this path instead of a rowData binding. */
export class DemoGridUpdates {
  private api?: GridApi<DemoRow>;

  connect(api: GridApi<DemoRow>, rows: readonly DemoRow[]): () => void {
    if (this.api && !this.api.isDestroyed())
      throw new DemoEditError('grid-unavailable', 'This table already has a connected grid.');
    if (
      api.isDestroyed() ||
      (api.getGridOption('rowModelType') !== undefined &&
        api.getGridOption('rowModelType') !== 'clientSide') ||
      !api.getGridOption('getRowId')
    )
      throw new DemoEditError(
        'grid-unavailable',
        'Client editing requires a live client-side grid and getRowId.',
      );
    api.expireValueCache();
    api.setGridOption('rowData', [...rows]);
    this.api = api;
    return () => {
      if (this.api === api) this.api = undefined;
    };
  }

  disconnect(): void {
    this.api = undefined;
  }

  replace(rows: readonly DemoRow[]): void {
    if (!this.api) return;
    if (this.api.isDestroyed()) {
      this.disconnect();
      return;
    }
    this.api.expireValueCache();
    this.api.setGridOption('rowData', [...rows]);
    const nodes = rows.flatMap((row) => {
      const node = this.api?.getRowNode(row.id);
      return node ? [node] : [];
    });
    this.api.refreshCells({ rowNodes: nodes, force: true });
  }

  commit(
    before: readonly DemoRow[],
    replacements: readonly DemoRow[],
    strategy: DemoClientStrategy,
  ): DemoRow[] {
    const api = this.api;
    if (!api || api.isDestroyed())
      throw new DemoEditError('grid-unavailable', 'The table grid is unavailable.');
    const nodes = replacements.map((row) => {
      const current = before.find((item) => item.id === row.id);
      const node = api.getRowNode(row.id);
      if (!current || !node || node.data !== current)
        throw new DemoEditError('grid-unavailable', 'Grid data is out of sync with table state.');
      return node;
    });
    const originals = replacements.map((row) => before.find((item) => item.id === row.id)!);
    const snapshots = originals.map((row) => ({ ...row }));
    try {
      api.expireValueCache();
      if (strategy === 'transaction') {
        const result = api.applyTransaction({ update: [...replacements] });
        if (
          !result ||
          result.update.length !== replacements.length ||
          nodes.some((node, index) => node.data !== replacements[index])
        )
          throw new DemoEditError('grid-unavailable', 'The grid rejected the row transaction.');
      } else {
        // These references are feature-owned copies, never external immutable store objects.
        originals.forEach((row, index) => Object.assign(row, replacements[index]));
      }
      // Transactions recalculate the model themselves unless the table suppresses it.
      // Direct mutations need the full grouping/filtering/aggregation/sorting pass.
      if (strategy === 'mutation' || api.getGridOption('suppressModelUpdateAfterUpdateTransaction'))
        api.refreshClientSideRowModel('group');
      // Refresh all columns in affected rows: metadata can change any marker or permission.
      api.refreshCells({ rowNodes: nodes, force: true });
      const byId = new Map(
        replacements.map((row, index) => [
          row.id,
          strategy === 'mutation' ? originals[index] : row,
        ]),
      );
      return before.map((row) => byId.get(row.id) ?? row);
    } catch (error: unknown) {
      if (strategy === 'mutation')
        originals.forEach((row, index) => Object.assign(row, snapshots[index]));
      // A partial transaction must not leave the grid ahead of canonical state.
      if (!api.isDestroyed()) {
        api.expireValueCache();
        api.setGridOption('rowData', [...before]);
      }
      throw error;
    }
  }
}
