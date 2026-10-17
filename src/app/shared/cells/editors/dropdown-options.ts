import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import type { DropdownOption } from '../renderers/dropdown-cell';
import type { CellEditor, EditorData } from './editor';

export type DropdownOptionsData<Row, V> = EditorData<Row, V> & {
  readonly options: readonly DropdownOption<V>[];
  readonly equals?: (left: V, right: V) => boolean;
};

/** The option list a dropdown cell opens. Choosing the current option only closes it. */
@Component({
  selector: 'cells-dropdown-options',
  template: `
    <div class="cells-options" role="group" aria-label="Options">
      @for (option of data().options; track $index) {
        <button
          type="button"
          [attr.aria-current]="$index === selectedIndex() || null"
          [disabled]="option.disabled || saving()"
          (click)="choose(option)"
        >
          {{ option.label }}
        </button>
      }
    </div>
    @if (error()) {
      <p class="cells-error" role="alert">{{ error() }}</p>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownOptions<Row, V> implements CellEditor<DropdownOptionsData<Row, V>> {
  readonly data = input.required<DropdownOptionsData<Row, V>>();

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly selectedIndex = computed(() => {
    const { value, options, equals = Object.is } = this.data();
    return value == null ? -1 : options.findIndex((option) => equals(option.value, value));
  });

  protected async choose(option: DropdownOption<V>): Promise<void> {
    const data = this.data();
    if (this.data().options.indexOf(option) === this.selectedIndex()) return data.close();
    this.saving.set(true);
    this.error.set('');
    try {
      await data.submit(option.value);
    } catch (error: unknown) {
      this.error.set(error instanceof Error ? error.message : String(error));
    } finally {
      this.saving.set(false);
    }
  }
}
