import { Directive, input } from '@angular/core';
import type { ContentState } from './content.model';

@Directive({
  selector: '[cellContent]',
  host: {
    class: 'grid-cell-content',
    '[style.text-align]': 'state().alignment',
    '[class.grid-cell-highlighted]': 'state().highlighted',
    '[class.grid-cell-muted]': 'state().disabled',
    '[class.grid-cell-ellipsis]': 'state().ellipsis',
    '[attr.title]': 'state().tooltip',
  },
})
export class CellContent {
  readonly state = input.required<ContentState>({ alias: 'cellContent' });
}
