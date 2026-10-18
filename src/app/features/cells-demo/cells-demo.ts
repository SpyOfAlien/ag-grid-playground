import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
  protected readonly busy = computed(() => this.session.entries().at(-1)?.status === 'pending');

  constructor() {
    void this.session.run('load', {});
  }

  /** Each mode has its own data; switching reloads from it. */
  protected setMode(mode: PersistenceMode): void {
    this.persistence.mode.set(mode);
    void this.session.run('load', {});
  }

  protected setReadOnly(readOnly: boolean): void {
    this.readOnly.set(readOnly);
    if (readOnly) this.session.lock('Table is read-only');
    else this.session.unlock();
  }
}
