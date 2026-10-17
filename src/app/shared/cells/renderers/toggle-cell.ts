import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { CellBase } from '../cell/cell';
import { controlView } from '../cell/control-state';
import { displayView, type DisplayParams } from '../cell/display';
import { submitEdit, type EditParams } from '../cell/edit';

export type ToggleCellParams<Row, P, M extends string = 'save'> = DisplayParams<Row, boolean> &
  EditParams<Row, boolean, P, boolean, M>;

@Component({
  selector: 'cells-toggle-cell',
  host: { class: 'cells-cell' },
  template: `
    @if (view(); as view) {
      @if (view.marker; as marker) {
        <span class="cells-marker" [attr.data-kind]="marker.kind" [title]="marker.tooltip"></span>
      }
      <button
        type="button"
        role="switch"
        class="cells-toggle"
        [attr.aria-checked]="view.checked"
        [attr.aria-label]="view.label"
        [attr.aria-disabled]="view.disabled"
        [attr.title]="view.tooltip"
        (click)="toggle($event)"
      ></button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleCell<Row, P, M extends string = 'save'> extends CellBase<
  Row,
  boolean,
  ToggleCellParams<Row, P, M>
> {
  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell) return null;
    return {
      ...displayView(params, cell),
      ...controlView(params, cell, params.context.session),
      checked: cell.value === true,
      label: params.colDef?.headerName ?? '',
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
