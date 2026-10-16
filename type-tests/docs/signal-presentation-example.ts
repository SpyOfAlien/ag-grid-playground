import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import type { RowDataUpdatedEvent } from 'ag-grid-community';
import {
  EditorHostService,
  NumberCell,
  withCellKeyboardColumns,
  type GridContext,
  type NumberCellParams,
} from '../../src/app/shared/grid-cells/public-api';

interface Row {
  id: string;
  amount: number;
}

@Component({
  selector: 'example-display-grid',
  imports: [AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ag-grid-angular
    [rowData]="rows"
    [columnDefs]="columns"
    [getRowId]="getRowId"
    (rowDataUpdated)="onRowsUpdated($event)"
  />`,
})
export class DisplayGridExample {
  readonly rows: Row[] = [];
  readonly getRowId = ({ data }: { data: Row }) => data.id;
  readonly columns = withCellKeyboardColumns<Row>([
    {
      field: 'amount',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({
        component: NumberCell,
        params: {
          content: {
            number: { decimals: 2 },
          },
        } satisfies NumberCellParams<Row>,
      }),
    },
  ]);

  onRowsUpdated(event: RowDataUpdatedEvent<Row>): void {
    event.api.refreshCells({ rowNodes: event.api.getRenderedNodes(), force: true });
  }
}

@Component({
  selector: 'example-signal-presentation',
  imports: [AgGridAngular],
  providers: [EditorHostService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button type="button" (click)="currency.set('EUR')">Use EUR</button>
    <ag-grid-angular
      [context]="context"
      [rowData]="rows"
      [columnDefs]="columns"
      [getRowId]="getRowId"
      (rowDataUpdated)="onRowsUpdated($event)"
    />`,
})
export class SignalPresentationExample {
  private readonly host = inject(EditorHostService);

  readonly currency = signal('USD');

  readonly rows: Row[] = [{ id: 'one', amount: 125 }];
  readonly context = { editorHost: this.host } satisfies GridContext;
  readonly getRowId = ({ data }: { data: Row }) => data.id;
  readonly amountParams = {
    content: {
      alignment: 'end',

      number: { decimals: 2, unit: () => this.currency() },
    },
  } satisfies NumberCellParams<Row>;
  readonly columns = withCellKeyboardColumns<Row>([
    {
      field: 'amount',
      cellClass: 'grid-kit-cell',
      cellRendererSelector: () => ({ component: NumberCell, params: this.amountParams }),
    },
  ]);

  onRowsUpdated(event: RowDataUpdatedEvent<Row>): void {
    event.api.refreshCells({ rowNodes: event.api.getRenderedNodes(), force: true });
  }
}
