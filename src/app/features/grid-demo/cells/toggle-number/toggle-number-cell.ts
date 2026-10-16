import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject, isDevMode } from '@angular/core';
import {
  BaseCell,
  CellContent,
  CellEditAction,
  CellMarker,
  CellToggle,
  cellSaveTarget,
  computeAction,
  computeMarker,
  computeNumberContent,
  computeToggle,
  openCellEditor,
  requireEditorHost,
  toCellContext,
  trackSave,
  type RendererParams,
} from '@grid-cells/composition';
import type { ToggleNumberCellParams } from './toggle-number-cell-params.model';

@Component({
  selector: 'app-toggle-number-cell',
  imports: [CellContent, CellMarker, CellEditAction, CellToggle],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      <div class="grid-cell-content composite-content">
        @if (cellToggle(); as toggle) {
          <button
            [cellToggle]="toggle"
            [cellToggleSave]="cellSave()"
            (toggled)="changeToggle($event)"
          ></button>
        }
        <span [cellContent]="content">{{ content.text }}</span>
      </div>
    }
    @if (cellAction(); as action) {
      @if (action.visible) {
        <button [cellEditAction]="action" (activated)="open($event)"></button>
      }
    }
  `,
  styleUrl: './toggle-number-cell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleNumberCell<R, D> extends BaseCell<
  RendererParams<R, number, ToggleNumberCellParams<R, D>>
> {
  private readonly announcer = inject(LiveAnnouncer);

  private readonly save = trackSave(() => cellSaveTarget(this.params()));
  readonly cellSave = this.save.state;

  readonly cellContent = computed(() => computeNumberContent(this.params()));
  readonly cellToggle = computed(() => computeToggle(this.params(), undefined, this.labels));
  readonly cellMarker = computed(() =>
    computeMarker(this.params(), undefined, this.markerDefinitions),
  );
  readonly cellAction = computed(() => {
    const action = computeAction(this.params(), undefined, this.labels);
    return action && this.cellSave().pending
      ? { ...action, disabled: true, tooltip: 'Saving review status.' }
      : action;
  });

  async changeToggle(next: boolean): Promise<void> {
    const params = this.params();
    if (!params || this.cellToggle()?.disabled) return;
    const cell = toCellContext(params);
    const outcome = await this.save.run(() => params.toggle.save(next, cell));
    if (outcome === 'failed') void this.announcer.announce(this.cellSave().error, 'assertive');
  }

  open(event: MouseEvent): void {
    const params = this.params();
    const action = this.cellAction();
    const trigger = event.currentTarget;
    if (!params || !action?.visible || action.disabled || !(trigger instanceof HTMLElement)) return;
    openCellEditor(params, trigger);
  }

  protected override validate(
    params: RendererParams<R, number, ToggleNumberCellParams<R, D>>,
  ): void {
    if (isDevMode() && params.action?.editor) requireEditorHost(params.context);
  }
}
