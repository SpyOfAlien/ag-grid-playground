import { ChangeDetectionStrategy, Component, computed, input, Signal } from '@angular/core';
import { OperationStatus } from '../operations/operation-controller';
export interface SwitchAction {
  readonly status: Signal<OperationStatus>;
  readonly allowed: () => boolean;
  activate(): unknown;
  dismiss(): void;
}
@Component({
  selector: 'tsys-switch-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button
    type="button"
    role="switch"
    [attr.aria-label]="label()"
    [attr.aria-checked]="checked()"
    [attr.aria-description]="cellDescription()"
    [disabled]="!action().allowed() || action().status().kind === 'pending'"
    (click)="action().activate()"
  >
    {{ checked() ? 'Reviewed' : 'Review' }}{{ action().status().kind === 'pending' ? '…' : '' }}
  </button>`,
})
export class SwitchControl {
  readonly action = input.required<SwitchAction>();
  readonly checked = input.required<boolean>();
  readonly label = input.required<string>();
  readonly cellDescription = computed(() => {
    const state = this.action().status();
    return state.kind === 'failed' ? state.message : state.kind === 'pending' ? 'Save pending' : '';
  });
}
