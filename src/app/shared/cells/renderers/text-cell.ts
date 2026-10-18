import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellMarker } from './cell-marker';
import { CellBase } from '../base/base';
import { cellDisplay, type DisplayParams } from '../base/display';
import { DISPLAY_TEMPLATE } from './display-template';

export type TextCellParams<Row> = DisplayParams<Row, string>;

@Component({
  selector: 'cells-text-cell',
  imports: [CellsTooltip, CellMarker],
  host: { class: 'cells-cell' },
  template: DISPLAY_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextCell<Row> extends CellBase<Row, string, TextCellParams<Row>> {
  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    return params && cell ? cellDisplay(params, cell) : null;
  });
}
