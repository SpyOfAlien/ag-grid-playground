import { computed, Directive, input } from '@angular/core';
import type { MarkerKind, MarkerState } from './marker.model';

const LABELS: Record<MarkerKind, string> = {
  error: 'Error',
  warning: 'Warning',
  userEdited: 'User edited value',
  systemGenerated: 'System generated value',
  info: 'Information',
  special: 'Special case',
};
@Directive({
  selector: '[cellMarker]',
  host: {
    class: 'grid-cell-marker',
    role: 'img',
    '[attr.data-kind]': 'state().kind',
    '[attr.title]': 'state().tooltip',
    '[attr.aria-label]': 'label()',
  },
})
export class CellMarker {
  readonly state = input.required<MarkerState>({ alias: 'cellMarker' });

  protected readonly label = computed(() => {
    const state = this.state();
    return state.tooltip ? `${LABELS[state.kind]}: ${state.tooltip}` : LABELS[state.kind];
  });
}
