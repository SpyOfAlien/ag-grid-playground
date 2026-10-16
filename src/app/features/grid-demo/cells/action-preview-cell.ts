import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import type { ICellRendererParams } from 'ag-grid-community';
import { BaseCell } from '../../../shared/grid-cells/core/base-cell';
import { CellContent } from '../../../shared/grid-cells/capabilities/content/cell-content';
import { CellMarker } from '../../../shared/grid-cells/capabilities/marker/cell-marker';
import { CellEditAction } from '../../../shared/grid-cells/capabilities/action/cell-edit-action';
import { computeTextContent } from '../../../shared/grid-cells/capabilities/content/compute-text-content';
import { computeMarker } from '../../../shared/grid-cells/capabilities/marker/compute-marker';
import { computeAction } from '../../../shared/grid-cells/capabilities/action/compute-action';
import type { TextCellParams } from '../../../shared/grid-cells/renderers/text/text-cell-params.model';
import type { ActionPart } from '../../../shared/grid-cells/capabilities/action/action.model';
import { toCellContext } from '../../../shared/grid-cells/core/cell-context';
import type { CellSave } from '../../../shared/grid-cells/editing/editors/value-editor.model';
import type { DemoRow } from '../demo-row.model';
import type { DemoGridContext } from '../demo-grid-context.model';

export type ActionPreviewParams = TextCellParams<DemoRow> &
  ActionPart<DemoRow, string> & { save: CellSave<DemoRow, string, void> };
@Component({
  selector: 'app-action-preview-cell',
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
        <button [cellEditAction]="action" (activated)="preview()"></button>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionPreviewCell extends BaseCell<
  ICellRendererParams<DemoRow, string, DemoGridContext> & ActionPreviewParams
> {
  readonly cellContent = computed(() => computeTextContent(this.params()));
  readonly cellMarker = computed(() => computeMarker(this.params()));
  readonly cellAction = computed(() => {
    const params = this.params();
    if (!params || params.context.demoPersistenceMode === 'client') return computeAction(params);
    return computeAction({
      ...params,
      action: {
        ...params.action,
        permission: {
          allowed: false,
          reason: 'This shortcut is client-only. Use the Details editor in server mode.',
        },
      },
    });
  });

  private submitting = false;

  preview(): void {
    const params = this.params();
    if (
      !params?.node.id ||
      !this.cellAction()?.visible ||
      this.cellAction()?.disabled ||
      this.submitting
    )
      return;
    const cell = toCellContext(params);
    this.submitting = true;
    void params
      .save(undefined, cell)
      .catch(() => undefined)
      .finally(() => {
        this.submitting = false;
      });
  }
}
