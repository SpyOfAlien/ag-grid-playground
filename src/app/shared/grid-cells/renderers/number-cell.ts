import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseCell } from '../core/base-cell';
import type { RendererParams } from '../core/grid-context';
import { CellContent, type ContentPart } from '../capabilities/content';
import { CellMarker, computeMarker, type MarkerPart } from '../capabilities/marker';
import { computeNumberContent } from '../capabilities/number';

export type NumberCellParams<R> = ContentPart<R, number> & MarkerPart<R, number>;

@Component({
  selector: 'app-number-cell',
  imports: [CellContent, CellMarker],
  host: { class: 'grid-cell' },
  template: `
    @if (cellMarker(); as marker) {
      <span [cellMarker]="marker"></span>
    }
    @if (cellContent(); as content) {
      <span [cellContent]="content">{{ content.text }}</span>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberCell<R> extends BaseCell<RendererParams<R, number, NumberCellParams<R>>> {
  readonly cellContent = computed(() => computeNumberContent(this.params()));
  readonly cellMarker = computed(() =>
    computeMarker(this.params(), undefined, this.markerDefinitions),
  );
}
