import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { EditorHostService } from '@grid-cells';
import { bindCellRenderer, NumberCell, type NumberCellParams } from '@grid-cells';
import { columns, options, type Row, type FeatureActions } from '../../public-api-usage';
const numberParams = {
  content: {
    number: { decimals: 2, unit: ({ data }) => data?.unit ?? null },
  },
} satisfies NumberCellParams<Row>;
@Component({
  selector: 'app-display-example',
  imports: [AgGridAngular],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<ag-grid-angular [rowData]="rows" [columnDefs]="columns" />',
})
export class DisplayExample {
  readonly rows: Row[] = [];
  readonly columns = [
    {
      field: 'amount' as const,
      cellClass: 'grid-kit-cell',
      ...bindCellRenderer(NumberCell<Row>, numberParams),
    },
  ];
}
@Component({
  selector: 'app-usage-example',
  imports: [AgGridAngular],
  providers: [EditorHostService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ag-grid-angular
    [gridOptions]="options"
    [columnDefs]="columns()"
    [context]="context"
  />`,
})
export class UsageExample {
  private readonly host = inject(EditorHostService);
  readonly actions = input.required<FeatureActions>();
  readonly columns = computed(() => columns(this.actions()));
  readonly context = { editorHost: this.host, currency: 'USD' };
  readonly options = options;
}
