import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseCell } from '../../core/base-cell';
import type { RendererParams } from '../../core/renderer-params.model';
import { CellContent } from '../../capabilities/content/cell-content';
import { CellMarker } from '../../capabilities/marker/cell-marker';
import { computeNumberContent } from '../../capabilities/number/compute-number-content';
import { computeMarker } from '../../capabilities/marker/compute-marker';
import type { NumberCellParams } from './number-cell-params.model';

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
  readonly cellMarker = computed(() => computeMarker(this.params()));
}
