import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseCell } from '../../core/base-cell';
import type { RendererParams } from '../../core/renderer-params.model';
import type { PopoverCellParams } from './popover-cell-params.model';
import { CellContent } from '../../capabilities/content/cell-content';
import { CellMarker } from '../../capabilities/marker/cell-marker';
import { CellEditAction } from '../../capabilities/action/cell-edit-action';
import { computeValueContent } from '../../capabilities/content/compute-value-content';
import { computeMarker } from '../../capabilities/marker/compute-marker';
import { computeAction } from '../../capabilities/action/compute-action';
import { toCellContext } from '../../core/cell-context';
@Component({
  selector: 'app-popover-cell',
  imports: [CellContent, CellMarker, CellEditAction],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      <span [cellContent]="content">{{ content.text }}</span>
    }
    @if (cellAction(); as action) {
      @if (action.visible) {
        <button [cellEditAction]="action" (activated)="open($event)"></button>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverCell<R, V, D> extends BaseCell<
  RendererParams<R, V, PopoverCellParams<R, V, D>>
> {
  readonly cellContent = computed(() => computeValueContent(this.params()));
  readonly cellMarker = computed(() => computeMarker(this.params()));
  readonly cellAction = computed(() => computeAction(this.params()));

  open(event: MouseEvent): void {
    const params = this.params();
    const action = this.cellAction();
    const trigger = event.currentTarget;
    if (!params?.action || !action?.visible || action.disabled || !(trigger instanceof HTMLElement))
      return;
    const hosts = params.context.editorHost;
    if (!hosts) throw new Error('Provide editorHost in grid context.');
    const cell = {
      ...toCellContext(params),
      trigger,
    };
    hosts.open(
      { component: params.action.editor.component, data: params.action.editor.data(cell) },
      {
        kind: 'popover',
        options:
          typeof params.action.editor.popover === 'function'
            ? params.action.editor.popover(cell)
            : params.action.editor.popover,
      },
      { trigger },
    );
  }
}
