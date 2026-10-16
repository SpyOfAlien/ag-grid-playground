import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseCell } from '../../core/base-cell';
import type { RendererParams } from '../../core/renderer-params.model';
import { CellContent } from '../../capabilities/content/cell-content';
import { CellMarker } from '../../capabilities/marker/cell-marker';
import { computeTextContent } from '../../capabilities/content/compute-text-content';
import { computeMarker } from '../../capabilities/marker/compute-marker';
import type { TextCellParams } from './text-cell-params.model';

@Component({
  selector: 'app-text-cell',
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
export class TextCell<R> extends BaseCell<RendererParams<R, string, TextCellParams<R>>> {
  readonly cellContent = computed(() => computeTextContent(this.params()));
  readonly cellMarker = computed(() => computeMarker(this.params()));
}
