import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellBase } from '../cell/cell';
import { displayView, type DisplayParams } from '../cell/display';
import { DISPLAY_TEMPLATE } from './display-template';

export type TextCellParams<Row> = DisplayParams<Row, string>;

@Component({
  selector: 'cells-text-cell',
  imports: [CellsTooltip],
  host: { class: 'cells-cell' },
  template: DISPLAY_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextCell<Row> extends CellBase<Row, string, TextCellParams<Row>> {
  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    return params && cell ? displayView(params, cell) : null;
  });
}
