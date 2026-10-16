import type { GridApi } from 'ag-grid-community';
import { DemoGridUpdates, type DemoClientStrategy } from './demo-grid-updates';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { EditorHostService } from '../../shared/grid-cells/editing/editor-host/public-api';
import type { DemoDatasetUpdate } from './api/demo-api.model';
import { createDemoRows, DEFAULT_ROW_COUNT } from './demo-fixtures';
import type { DemoRow, DemoPersistenceMode } from './demo-row.model';

@Injectable()
export class DemoTableState {
  private readonly editorHost = inject(EditorHostService, { optional: true });
  private readonly lifetime = inject(DestroyRef);

  private readonly rowsSource = signal(createDemoRows(DEFAULT_ROW_COUNT));
  readonly mode = signal<DemoPersistenceMode>('client');
  readonly rows = this.rowsSource.asReadonly();

  private readonly grid = new DemoGridUpdates();
  private generation = 0;

  constructor() {
    this.lifetime.onDestroy(() => this.grid.disconnect());
  }

  /** Own grid synchronization here. Do not bind rows() to rowData on a connected table. */
  connectGrid(api: GridApi<DemoRow>): () => void {
    return this.grid.connect(api, this.rows());
  }

  commitClientRows(rows: readonly DemoRow[], strategy: DemoClientStrategy): void {
    this.validateRows(rows);
    const before = this.rows();
    if (rows.length !== before.length || rows.some((row, index) => row.id !== before[index].id))
      throw new Error('Client edits must preserve row identities and order.');
    const changed = rows.filter((row, index) => row !== before[index]);
    if (!changed.length) return;
    const next = this.grid.commit(before, changed, strategy);
    this.rowsSource.set(next);
  }

  private publishRows(rows: DemoRow[]): void {
    this.grid.replace(rows);
    this.rowsSource.set(rows);
  }

  getDatasetGeneration(): number {
    return this.generation;
  }
  reset(rows: readonly DemoRow[]): void {
    this.validateRows(rows);
    this.generation++;
    this.editorHost?.close();
    this.publishRows(structuredClone([...rows]));
  }
  getRow(rowId: string): Readonly<DemoRow> | undefined {
    return this.rows().find((row) => row.id === rowId);
  }
  /** Accepted edit responses do not invalidate the dataset generation. */
  commitServerUpdate(update: DemoDatasetUpdate): void {
    this.validateRows(update.rows);
    if (update.kind === 'replace-rows') {
      this.publishRows(structuredClone([...update.rows]));
      return;
    }
    const byId = new Map(this.rows().map((row) => [row.id, row]));
    for (const row of update.rows) byId.set(row.id, structuredClone(row));
    this.publishRows([...byId.values()]);
  }
  private validateRows(rows: readonly DemoRow[]): void {
    const ids = new Set<string>();
    for (const row of rows) {
      if (!row.id || ids.has(row.id)) throw new Error('Row IDs must be nonempty and unique.');
      ids.add(row.id);
    }
  }
}
