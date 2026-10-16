import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AgGridAngular } from 'ag-grid-angular';
import { type GridOptions, type GridReadyEvent, themeQuartz } from 'ag-grid-community';
import { withCellKeyboardColumns, type GridContext } from '../../shared/grid-cells/public-api';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { EditorHostService } from '../../shared/grid-cells/editing/editor-host/public-api';
import { provideDemoEditing } from './demo-editing-providers';
import { DemoClientPersistence } from './demo-client-persistence';
import { DemoServerPersistence } from './demo-server-persistence';
import { createCustomDemoColumns } from './demo-columns';
import { createDemoRows } from './demo-fixtures';
import type { DemoRow } from './demo-row.model';
import { DemoTableState } from './demo-table-state';
import { DemoApiScenarios } from './api/demo-api-scenarios';
import { registerDemoGrid } from '../../shared/ag-grid/grid-registration';
import { createDemoUserEditedPredicate } from './demo-user-edited';

registerDemoGrid();

@Component({
  selector: 'app-grid-demo',
  providers: provideDemoEditing(),
  imports: [
    AgGridAngular,
    MatCheckboxModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './grid-demo.html',
  styleUrl: './grid-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GridDemo {
  private readonly destroyRef = inject(DestroyRef);
  private readonly client = inject(DemoClientPersistence);
  private readonly server = inject(DemoServerPersistence);
  readonly editors = inject(EditorHostService);
  readonly apiScenarios = inject(DemoApiScenarios);
  readonly tableState = inject(DemoTableState);

  readonly rows = this.tableState.rows;
  readonly mode = this.tableState.mode;
  readonly showUnits = signal(true);
  readonly message = signal('Hover a cell to show its edit action.');

  readonly persistence = computed(() => (this.mode() === 'server' ? this.server : this.client));
  readonly pendingCount = computed(() => this.client.pending() + this.server.pending());
  readonly controlsDisabled = computed(() => this.pendingCount() > 0 || this.editors.active());
  readonly applicationContext = { editorHost: this.editors } satisfies GridContext;

  private readonly isUserEdited = createDemoUserEditedPredicate();
  readonly columns = withCellKeyboardColumns(
    createCustomDemoColumns(this.isUserEdited, () => this.persistence(), this.showUnits),
  );
  readonly options: GridOptions<DemoRow> = {
    columnDefs: this.columns,
    defaultColDef: {
      sortable: true,

      resizable: true,
      editable: false,
      suppressHeaderMenuButton: true,
    },
    suppressDragLeaveHidesColumns: true,
    getRowId: ({ data }) => data.id,
    loading: false,
    rowHeight: 40,
    headerHeight: 44,
    animateRows: false,
    theme: themeQuartz.withParams({
      accentColor: '#17675b',
      cellHorizontalPadding: 24,
      fontSize: 13,
    }),
  };

  constructor() {
    this.tableState.reset(this.createRows());
    this.destroyRef.onDestroy(() => this.isUserEdited.clear());
    effect(() => {
      const completion = this.persistence().completion();
      if (!completion) return;
      this.message.set(
        completion.kind === 'success'
          ? `${untracked(() => this.mode()) === 'server' ? 'Server' : 'Client'} edit saved: ${completion.cell.rowId}.`
          : `Edit failed: ${completion.error instanceof Error ? completion.error.message : String(completion.error)}`,
      );
    });
  }

  onGridReady(event: GridReadyEvent<DemoRow>): void {
    this.tableState.connectGrid(event.api);
    event.api.setGridAriaProperty('label', 'Cell editor showcase');
  }

  setMode(value: string): void {
    if (this.controlsDisabled() || (value !== 'client' && value !== 'server')) return;
    this.mode.set(value);
    this.message.set(
      value === 'server'
        ? 'Server edits use a local mock API returning recalculated rows.'
        : 'Client edits update the shared table state.',
    );
  }

  reset(): void {
    if (this.controlsDisabled()) return;
    this.tableState.reset(this.createRows());
    this.isUserEdited.clear();
    this.message.set('Demo values reset.');
  }

  private createRows(): DemoRow[] {
    return createDemoRows(12).map((row, index) =>
      index === 11
        ? { ...row, metrics: row.metrics.map((value, metric) => (metric === 7 ? null : value)) }
        : row,
    );
  }

  setOutcome(value: string): void {
    if (this.controlsDisabled() || (value !== 'success' && value !== 'failure')) return;
    this.apiScenarios.outcome.set(value);
  }
}
