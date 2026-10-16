import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Choice, computeChoiceIndex } from '../presentation/display';
@Component({
  selector: 'tsys-choice-control',
  host: { class: 'tsys-choice-control' },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<select
    [attr.aria-label]="label()"
    [attr.aria-description]="description()"
    [disabled]="disabled()"
    [value]="cellContent()"
    (change)="choose($event)"
  >
    <option value="-1" disabled>Unmatched value</option>
    @for (choice of choices(); track $index) {
      <option [value]="$index" [disabled]="choice.disabled">{{ choice.label }}</option>
    }
  </select>`,
})
export class ChoiceControl<V> {
  readonly choices = input.required<readonly Choice<V>[]>();
  readonly value = input.required<V>();
  readonly equals = input<(a: V, b: V) => boolean>(Object.is);
  readonly disabled = input(false);
  readonly label = input.required<string>();
  readonly description = input('');
  readonly selection = output<V>();
  readonly cellContent = computed(() =>
    computeChoiceIndex(this.value(), this.choices(), this.equals()),
  );
  choose(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const choice = this.choices()[Number(select.value)];
    if (!this.disabled() && choice && !choice.disabled) this.selection.emit(choice.value);
    select.value = String(this.cellContent());
  }
}
