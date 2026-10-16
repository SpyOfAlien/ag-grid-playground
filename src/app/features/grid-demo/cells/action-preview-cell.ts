import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import type { ICellRendererParams } from 'ag-grid-community';
import {
  BaseCell,
  CellContent,
  CellEditAction,
  CellMarker,
  computeAction,
  computeMarker,
  computeTextContent,
  toCellContext,
  type ActionPart,
  type CellSave,
  type TextCellParams,
} from '@grid-cells/composition';
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
  readonly cellMarker = computed(() =>
    computeMarker(this.params(), undefined, this.markerDefinitions),
  );
  readonly cellAction = computed(() => {
    const params = this.params();
    if (!params || params.context.demoPersistenceMode === 'client')
      return computeAction(params, undefined, this.labels);
    return computeAction(
      {
        ...params,
        action: {
          ...params.action,
          permission: {
            allowed: false,
            reason: 'This shortcut is client-only. Use the Details editor in server mode.',
          },
        },
      },
      undefined,
      this.labels,
    );
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
