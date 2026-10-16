import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { BaseCell } from '../core/base-cell';
import type { RendererParams } from '../core/grid-context';
import { CellContent, computeTextContent, type ContentPart } from '../capabilities/content';
import { CellMarker, computeMarker, type MarkerPart } from '../capabilities/marker';

export type TextCellParams<R> = ContentPart<R, string> & MarkerPart<R, string>;

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
  readonly cellMarker = computed(() =>
    computeMarker(this.params(), undefined, this.markerDefinitions),
  );
}
