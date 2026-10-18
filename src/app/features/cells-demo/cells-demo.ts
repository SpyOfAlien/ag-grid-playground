import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AgGridAngular } from 'ag-grid-angular';
import { themeQuartz } from 'ag-grid-community';
import { cellGridOptions, createEditSession } from '@cells';
import { EditHistory } from './edit-history';
import { registerDemoGrid } from '../../shared/ag-grid/grid-registration';
import { inventoryColumns, summaryColumns } from './inventory-columns';
import { InventoryPersistence, type PersistenceMode } from './inventory-persistence';
import { sku } from './inventory-rules';

registerDemoGrid();

const theme = themeQuartz.withParams({ accentColor: '#17675b', fontSize: 13 });

@Component({
  selector: 'app-cells-demo',
  imports: [AgGridAngular, EditHistory],
  providers: [InventoryPersistence],
  templateUrl: './cells-demo.html',
  styleUrl: './cells-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellsDemo {
  private readonly snackBar = inject(MatSnackBar);
  protected readonly persistence = inject(InventoryPersistence);
  protected readonly session = createEditSession(this.persistence, sku);

  protected readonly inventory = cellGridOptions(this.session, {
    columnDefs: inventoryColumns(),
    rowHeight: 40,
    // Keep every column in the DOM while scrolling sideways.
    suppressColumnVirtualisation: true,
    theme,
    onGridReady: ({ api }) => api.setGridAriaProperty('label', 'Inventory'),
  });
  protected readonly summary = cellGridOptions(this.session, {
    columnDefs: summaryColumns(),
    rowHeight: 32,
    theme,
    onGridReady: ({ api }) => api.setGridAriaProperty('label', 'Stock summary'),
  });

  protected readonly readOnly = signal(false);
  protected readonly busy = this.session.busy;

  constructor() {
    void this.session.run({ method: 'load' });
    // Cells do not show failures; the page reports each failed entry once.
    effect(() => {
      const last = this.session.entries().at(-1);
      const error = last?.status === 'failed' ? last.error : undefined;
      if (error) untracked(() => this.snackBar.open(error, 'Dismiss', { duration: 6000 }));
    });
  }

  /** Each mode has its own data; switching reloads from it. */
  protected setMode(mode: PersistenceMode): void {
    this.persistence.mode.set(mode);
    void this.session.run({ method: 'load' });
  }

  protected setReadOnly(readOnly: boolean): void {
    this.readOnly.set(readOnly);
    if (readOnly) this.session.lock('Table is read-only');
    else this.session.unlock();
  }
}
