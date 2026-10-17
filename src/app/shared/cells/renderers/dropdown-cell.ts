import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { CellBase, evaluate, type CellRule } from '../cell/cell';
import { controlView } from '../cell/control-state';
import { displayView, type DisplayParams } from '../cell/display';
import type { EditParams } from '../cell/edit';
import { DropdownOptions } from '../editors/dropdown-options';
import { cellEditorData, openCellPopover } from '../editors/editor';

export interface DropdownOption<V> {
  readonly value: V;
  readonly label: string;
  readonly disabled?: boolean;
}

export type DropdownCellParams<Row, V, P, M extends string = 'save'> = DisplayParams<Row, V> &
  EditParams<Row, V, P, V, M> & {
    options: CellRule<Row, V, readonly DropdownOption<V>[]>;
    /** Shown when the value matches no option, like `mat-select`. */
    placeholder?: string;
    equals?: (left: V, right: V) => boolean;
  };

@Component({
  selector: 'cells-dropdown-cell',
  host: { class: 'cells-cell' },
  template: `
    @if (view(); as view) {
      @if (view.marker; as marker) {
        <span class="cells-marker" [attr.data-kind]="marker.kind" [title]="marker.tooltip"></span>
      }
      <button
        type="button"
        class="cells-dropdown"
        [class.cells-placeholder]="view.selected === null"
        [attr.aria-disabled]="view.disabled"
        [attr.title]="view.tooltip"
        (click)="open($event)"
      >
        {{ view.selected?.label ?? view.placeholder }}
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownCell<Row, V, P, M extends string = 'save'> extends CellBase<
  Row,
  V,
  DropdownCellParams<Row, V, P, M>
> {
  private readonly injector = inject(Injector);

  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell) return null;
    const options = evaluate(params.options, cell);
    const equals = params.equals ?? Object.is;
    const value = cell.value;
    return {
      ...displayView(params, cell),
      ...controlView(params, cell, params.context.session),
      options,
      selected:
        value == null ? null : (options.find((option) => equals(option.value, value)) ?? null),
      placeholder: params.placeholder ?? '',
    };
  });

  protected open(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    const view = this.view();
    if (!params || !cell || !view || view.disabled) return;
    const trigger = event.currentTarget as HTMLElement;
    openCellPopover(this.injector, trigger, DropdownOptions<Row, V>, (close) => ({
      ...cellEditorData<Row, V, V>(params, cell, close),
      options: view.options,
      equals: params.equals,
    }));
  }
}
