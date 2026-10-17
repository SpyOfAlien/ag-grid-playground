import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellBase } from '../cell/cell';
import { displayView, type DisplayParams } from '../cell/display';
import { formatNumber, type NumberFormat } from '../cell/format';
import { DISPLAY_TEMPLATE } from './display-template';

export type NumberCellParams<Row> = DisplayParams<Row, number> & {
  /** Built-in number format, used when `format` is not set. */
  number?: NumberFormat<Row>;
};

@Component({
  selector: 'cells-number-cell',
  imports: [CellsTooltip],
  host: { class: 'cells-cell' },
  template: DISPLAY_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberCell<Row> extends CellBase<Row, number, NumberCellParams<Row>> {
  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    return params && cell
      ? displayView(params, cell, () => formatNumber(params.number, cell))
      : null;
  });
}
