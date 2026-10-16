import { Directive, input, output } from '@angular/core';
import type { ActionState } from './action.model';

/** Applies pen state and guards activation; the renderer delegates opening to its editor host. */
@Directive({
  selector: 'button[cellEditAction]',
  host: {
    class: 'grid-cell-action',
    type: 'button',
    tabindex: '0',
    'aria-label': 'Edit value',
    '[attr.aria-disabled]': 'state().disabled',
    '[attr.title]': 'state().tooltip',
    '(click)': 'activate($event)',
  },
})
export class CellEditAction {
  readonly state = input.required<ActionState>({ alias: 'cellEditAction' });
  readonly activated = output<MouseEvent>();

  protected activate(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const state = this.state();
    if (state.visible && !state.disabled) this.activated.emit(event);
  }
}
