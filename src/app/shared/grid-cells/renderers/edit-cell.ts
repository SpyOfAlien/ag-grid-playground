import { ChangeDetectionStrategy, Component, computed, isDevMode } from '@angular/core';
import { BaseCell } from '../core/base-cell';
import { requireEditorHost, type RendererParams } from '../core/grid-context';
import {
  CellEditAction,
  computeAction,
  openCellEditor,
  type ActionPart,
} from '../capabilities/action';
import { CellContent, type ContentPart } from '../capabilities/content';
import { CellMarker, computeMarker, type MarkerPart } from '../capabilities/marker';
import { computeValueContent } from '../capabilities/number';
import type { EditablePart } from '../capabilities/permission';
import type { CellEditorConfig } from '../editing/cell-editor';

export type EditCellParams<R, V, D> = ContentPart<R, V> &
  MarkerPart<R, V> &
  EditablePart<R, V> &
  ActionPart<R, V, CellEditorConfig<R, V, D>>;

/** Displays a value and opens its editor in any registered presentation. */
@Component({
  selector: 'app-edit-cell',
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
export class EditCell<R, V, D> extends BaseCell<RendererParams<R, V, EditCellParams<R, V, D>>> {
  readonly cellContent = computed(() => computeValueContent(this.params()));
  readonly cellMarker = computed(() =>
    computeMarker(this.params(), undefined, this.markerDefinitions),
  );
  readonly cellAction = computed(() => computeAction(this.params(), undefined, this.labels));

  open(event: MouseEvent): void {
    const params = this.params();
    const action = this.cellAction();
    const trigger = event.currentTarget;
    if (!params || !action?.visible || action.disabled || !(trigger instanceof HTMLElement)) return;
    openCellEditor(params, trigger);
  }

  protected override validate(params: RendererParams<R, V, EditCellParams<R, V, D>>): void {
    if (isDevMode() && params.action?.editor && params.action.enabled !== false)
      requireEditorHost(params.context);
  }
}
