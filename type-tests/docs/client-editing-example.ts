import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { GridOptions, GridReadyEvent } from 'ag-grid-community';
import {
  withCellKeyboardColumns,
  EditorHostService,
  InputEditor,
  EditCell,
  type InputEditorData,
  type EditCellParams,
} from '@grid-cells';
import {
  provideDemoServerEditing,
  provideDemoClientEditing,
} from '../../src/app/features/grid-demo/demo-editing-providers';
import { DEMO_TABLE_PERSISTENCE } from '../../src/app/features/grid-demo/demo-persistence.model';
import { DemoTableState } from '../../src/app/features/grid-demo/demo-table-state';
import type { DemoRow } from '../../src/app/features/grid-demo/demo-row.model';

@Component({
  selector: 'example-client-table',
  imports: [AgGridAngular],
  providers: provideDemoClientEditing(),
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ag-grid-angular
    style="height: 400px"
    [context]="context"
    [gridOptions]="gridOptions"
    (gridReady)="onGridReady($event)"
  />`,
})
export class ClientTableExample {
  private readonly persistence = inject(DEMO_TABLE_PERSISTENCE);
  private readonly host = inject(EditorHostService);
  readonly table = inject(DemoTableState);
  readonly context = { editorHost: this.host };
  readonly amountParams = {
    action: {
      tooltip: 'Edit amount',
      permission: ({ data }) =>
        data?.metadata.reviewed
          ? { allowed: true }
          : { allowed: false, reason: 'Review this row before editing.' },

      editor: {
        component: InputEditor<number>,
        data: (cell) => {
          if (!cell.rowId) throw new Error('Missing row.');
          const rowId = cell.rowId;
          return {
            initialValue: cell.value ?? null,
            config: { label: 'Amount', mode: 'number' },
            save: (value) => this.saveAmount(rowId, value),
          };
        },

        presentation: { kind: 'popover', options: { width: 320 } },
      },
    },
  } satisfies EditCellParams<DemoRow, number, InputEditorData<number>>;
  readonly gridOptions: GridOptions<DemoRow> = {
    getRowId: ({ data }) => data.id,
    columnDefs: withCellKeyboardColumns<DemoRow>([
      {
        colId: 'metric-2',
        headerName: 'Amount',
        valueGetter: ({ data }) => data?.metrics[2],
        cellClass: 'grid-kit-cell',
        cellRendererSelector: () => ({ component: EditCell, params: this.amountParams }),
      },
    ]),
  };

  onGridReady(event: GridReadyEvent<DemoRow>): void {
    this.table.connectGrid(event.api);
  }

  saveAmount(rowId: string, value: number | null): Promise<void> {
    return this.persistence.saveAmount({
      cell: { rowId, columnId: 'metric-2' },
      data: { value },
    });
  }
}

provideDemoClientEditing('mutation');
provideDemoServerEditing();
// @ts-expect-error The feature defines exactly two supported client strategies.
provideDemoClientEditing('replace');
