import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellMarker } from './cell-marker';
import { CellBase } from '../base/base';
import { cellDisplay, type DisplayParams } from '../base/display';
import { formatNumber, type NumberFormat } from '../base/format';
import { DISPLAY_TEMPLATE } from './display-template';

export type NumberCellParams<Row> = DisplayParams<Row, number> & {
  /** Built-in number format, used when `format` is not set. */
  number?: NumberFormat<Row>;
};

@Component({
  selector: 'cells-number-cell',
  imports: [CellsTooltip, CellMarker],
  host: { class: 'cells-cell' },
  template: DISPLAY_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberCell<Row> extends CellBase<Row, number, NumberCellParams<Row>> {
  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    return params && cell
      ? cellDisplay(params, cell, () => formatNumber(params.number, cell))
      : null;
  });
}
