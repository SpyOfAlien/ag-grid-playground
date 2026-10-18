import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellMarker } from './cell-marker';
import { CellBase } from '../base/base';
import { cellControl } from '../base/control';
import { cellDisplay, type DisplayParams } from '../base/display';
import { submitEdit, type EditParams } from '../base/edit';

export type ToggleCellParams<Row, P> = DisplayParams<Row, boolean> &
  EditParams<Row, boolean, P, boolean>;

@Component({
  selector: 'cells-toggle-cell',
  imports: [CellsTooltip, CellMarker],
  host: { class: 'cells-cell' },
  template: `
    @if (view(); as view) {
      @if (view.marker; as marker) {
        <span [cellsMarker]="marker" [position]="view.tooltipPosition"></span>
      }
      <button
        type="button"
        role="switch"
        class="cells-toggle"
        [attr.aria-checked]="view.checked"
        [attr.aria-label]="view.label"
        [attr.aria-disabled]="view.disabled"
        [cellsTooltip]="view.tooltip"
        [cellsTooltipPosition]="view.tooltipPosition"
        (click)="toggle($event)"
      ></button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleCell<Row, P> extends CellBase<Row, boolean, ToggleCellParams<Row, P>> {
  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell) return null;
    return {
      ...cellDisplay(params, cell),
      ...cellControl(params, cell, params.context.session, params.colDef?.headerName ?? ''),
      checked: cell.value === true,
    };
  });

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell || this.view()?.disabled) return;
    // Failures are recorded by the session and shown through the tooltip.
    void submitEdit(params, cell, cell.value !== true).catch(() => undefined);
  }
}
