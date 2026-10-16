import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { BaseCell } from '../core/base-cell';
import { toCellContext } from '../core/cell-context';
import type { RendererParams } from '../core/grid-context';
import { CellContent, computeContent, type ContentPart } from '../capabilities/content';
import { CellMarker, computeMarker, type MarkerPart } from '../capabilities/marker';
import type { EditablePart } from '../capabilities/permission';
import { cellSaveTarget, trackSave } from '../capabilities/save';
import { CellToggle, computeToggle, type TogglePart } from '../capabilities/toggle';

export type ToggleCellParams<R> = ContentPart<R, boolean> &
  MarkerPart<R, boolean> &
  EditablePart<R, boolean> &
  TogglePart<R>;

@Component({
  selector: 'app-toggle-cell',
  imports: [CellContent, CellMarker, CellToggle],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      <span [cellContent]="content">
        @if (cellToggle(); as toggle) {
          <button
            [cellToggle]="toggle"
            [cellToggleSave]="cellSave()"
            (toggled)="change($event)"
          ></button>
        }
      </span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToggleCell<R> extends BaseCell<RendererParams<R, boolean, ToggleCellParams<R>>> {
  private readonly announcer = inject(LiveAnnouncer);

  private readonly save = trackSave(() => cellSaveTarget(this.params()));
  readonly cellSave = this.save.state;

  readonly cellContent = computed(() => computeContent(this.params()));
  readonly cellMarker = computed(() =>
    computeMarker(this.params(), undefined, this.markerDefinitions),
  );
  readonly cellToggle = computed(() => computeToggle(this.params(), undefined, this.labels));

  async change(next: boolean): Promise<void> {
    const params = this.params();
    if (!params || this.cellToggle()?.disabled) return;
    const cell = toCellContext(params);
    const outcome = await this.save.run(() => params.toggle.save(next, cell));
    if (outcome === 'failed') void this.announcer.announce(this.cellSave().error, 'assertive');
  }
}
