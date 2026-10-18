import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { ActiveMarker } from '../base/markers';
import { CellsTooltipService, tooltipAttributes, type TooltipPosition } from '../tooltip/tooltip';

/**
 * A cell's marker with its tooltip. It sits on the renderer's own `<span>`, so it adds no element:
 * `<span [cellsMarker]="state.marker" [position]="state.tooltipPosition"></span>`.
 */
@Component({
  selector: 'span[cellsMarker]',
  template: '',
  host: {
    class: 'cells-marker',
    '[attr.data-kind]': 'marker().kind',
    '[attr.data-cells-tooltip]': 'tooltip().text',
    '[attr.data-cells-tooltip-html]': 'tooltip().html',
    '[attr.data-cells-tooltip-position]': 'tooltip().position',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CellMarker {
  readonly marker = input.required<ActiveMarker>({ alias: 'cellsMarker' });
  /** Where the tooltip shows; defaults to below. */
  readonly position = input<TooltipPosition | null>(null);

  protected readonly tooltip = computed(() =>
    tooltipAttributes(this.marker().tooltip, this.position()),
  );

  constructor() {
    inject(CellsTooltipService).start();
  }
}
