import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Validators } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import type { RowDataUpdatedEvent } from 'ag-grid-community';
import {
  withCellKeyboardColumns,
  EditorHostService,
  InputEditor,
  PopoverCell,
  type InputEditorData,
  type PopoverCellParams,
} from '../../../src/app/shared/grid-cells/public-api';
import { ApiExample } from '../api-example';
import { RowState, type Row } from '../row-state';

@Component({
  selector: 'example-amount-table',
  imports: [AgGridAngular],
  providers: [EditorHostService, RowState, ApiExample],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ag-grid-angular
    style="height: 400px"
    [context]="context"
    [rowData]="state.rows()"
    [columnDefs]="columns"
    [getRowId]="getRowId"
    (rowDataUpdated)="onRowsUpdated($event)"
  />`,
})
export class AmountTableExample {
  private readonly host = inject(EditorHostService);
  private readonly persistence = inject(ApiExample);
  readonly state = inject(RowState);

  readonly context = { editorHost: this.host };
  readonly getRowId = ({ data }: { data: Row }) => data.id;
  readonly amountParams = {
    content: { alignment: 'end' },
    action: {
      tooltip: 'Edit amount',
      permission: ({ data }) =>
        data?.reviewed
          ? { allowed: true }
          : { allowed: false, reason: 'Review this row before editing.' },

      editor: {
        component: InputEditor<number>,
        data: (cell) => {
          if (!cell.rowId) throw new Error('Missing row.');
          const identity = { rowId: cell.rowId, columnId: cell.columnId };
          return {
            initialValue: cell.value ?? null,
            config: { label: 'Amount', mode: 'number', validators: [Validators.min(0)] },
            save: (value) =>
              this.persistence.saveAmount({
                cell: identity,
                data: { value },
                queryParams: { source: 'amount', include: ['totals', 'status'] },
              }),
          };
        },

        popover: ({ trigger }) => ({
          anchor: { kind: 'element', element: trigger },
          placement: 'bottom',
          width: 320,
        }),
      },
    },
  } satisfies PopoverCellParams<Row, number, InputEditorData<number>>;
  readonly columns = withCellKeyboardColumns<Row>([
    {
      field: 'amount',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({ component: PopoverCell, params: this.amountParams }),
    },
  ]);

  onRowsUpdated(event: RowDataUpdatedEvent<Row>): void {
    event.api.refreshCells({ rowNodes: event.api.getRenderedNodes(), force: true });
  }
}
