import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import {
  MatListModule,
  MatSelectionList,
  type MatSelectionListChange,
} from '@angular/material/list';
import { GRID_CELL_LABELS } from '../core/labels';
import type { DropdownOption } from '../capabilities/dropdown';

/** Material selection inside the existing editor overlay; selection emits an intent. */
@Component({
  selector: 'app-dropdown-options',
  imports: [MatListModule],
  host: { '(keydown)': '$event.stopPropagation()' },
  template: `
    @if (selectedIndex() === -1) {
      <p class="placeholder">{{ placeholder() ?? labels.dropdownPlaceholder }}</p>
    }
    <mat-selection-list
      [attr.aria-label]="labels.dropdownList"
      [multiple]="false"
      [hideSingleSelectionIndicator]="true"
      [disabled]="disabled()"
      (selectionChange)="choose($event)"
    >
      @for (option of options(); track $index) {
        <mat-list-option
          [value]="$index"
          [selected]="selectedIndex() === $index"
          [class.selected]="selectedIndex() === $index"
          [disabled]="option.disabled"
          (click)="confirm($index)"
          (keydown.enter)="confirm($index)"
          (keydown.space)="confirm($index)"
        >
          <span matListItemTitle [title]="option.label">{{ option.label }}</span>
        </mat-list-option>
      }
    </mat-selection-list>
  `,
  styleUrl: './dropdown-options.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownOptions<V> {
  protected readonly labels = inject(GRID_CELL_LABELS);

  private readonly list = viewChild.required(MatSelectionList);
  readonly options = input.required<readonly DropdownOption<V>[]>();
  readonly value = input<V | null | undefined>();
  readonly equals = input<(left: V, right: V) => boolean>(Object.is);
  readonly placeholder = input<string>();
  readonly disabled = input(false);
  readonly selected = output<V>();

  readonly selectedIndex = computed(() => {
    const value = this.value();
    return value == null
      ? -1
      : this.options().findIndex((option) => this.equals()(option.value, value));
  });

  choose(event: MatSelectionListChange): void {
    const index: unknown = event.options[0]?.value;
    // Material updates selection immediately. Restore the committed value before emitting intent.
    const committed = this.selectedIndex();
    for (const option of this.list().options) option.selected = option.value === committed;
    if (this.disabled()) return;
    const option =
      typeof index === 'number' && Number.isInteger(index) ? this.options()[index] : undefined;
    if (!option || option.disabled) return;
    const value = this.value();
    if (value != null && this.equals()(option.value, value)) return;
    this.selected.emit(option.value);
  }

  /** Material emits no change for the selected option; choosing it again still confirms it. */
  confirm(index: number): void {
    const option = this.options()[index];
    if (this.disabled() || index !== this.selectedIndex() || !option || option.disabled) return;
    this.selected.emit(option.value);
  }
}
