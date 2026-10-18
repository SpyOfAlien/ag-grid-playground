import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellMarker } from './cell-marker';
import { CellBase } from '../base/base';
import { cellControl } from '../base/control';
import { cellDisplay, type DisplayParams } from '../base/display';
import { runCommand, type ActionParams } from '../base/edit';

/** A switch has no value text, so no `content`: markers and the action only. */
export type ToggleCellParams<Row, P> = Omit<DisplayParams<Row, boolean>, 'content'> & {
  action?: ActionParams<Row, boolean, P, boolean>;
};

@Component({
  selector: 'cells-toggle-cell',
  imports: [CellsTooltip, CellMarker],
  host: { class: 'cells-cell' },
  template: `
    @if (state(); as state) {
      @if (state.marker; as marker) {
        <span [cellsMarker]="marker" [position]="state.tooltipPosition"></span>
      }
      <button
        type="button"
        role="switch"
        class="cells-toggle"
        [attr.aria-checked]="state.checked"
        [attr.aria-label]="state.control.name"
        [attr.aria-disabled]="state.control.disabled"
        [cellsTooltip]="state.control.tooltip"
        [cellsTooltipPosition]="state.tooltipPosition"
        (click)="toggle($event)"
      ></button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleCell<Row, P> extends CellBase<Row, boolean, ToggleCellParams<Row, P>> {
  protected readonly state = computed(() => {
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell) return null;
    const { marker, tooltipPosition } = cellDisplay(params, cell);
    const header = params.colDef?.headerName ?? '';
    return {
      marker,
      tooltipPosition,
      control: cellControl(params.action, cell, params.context.session, header),
      checked: cell.value === true,
    };
  });

  protected toggle(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell || this.state()?.control.disabled) return;
    // Failures are recorded on the session entry; the page reports them.
    void runCommand(params, params.action?.command, cell, cell.value !== true).catch(
      () => undefined,
    );
  }
}
