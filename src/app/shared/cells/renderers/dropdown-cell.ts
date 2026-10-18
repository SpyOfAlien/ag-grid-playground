import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellMarker } from './cell-marker';
import { CellBase, evaluate, type CellRule } from '../base/base';
import { cellControl } from '../base/control';
import { cellDisplay, type ContentParams, type DisplayParams } from '../base/display';
import type { ActionParams } from '../base/edit';
import { DropdownOptions } from '../editors/dropdown-options';
import { cellEditorData, openCellPopover } from '../editors/editor';

export interface DropdownOption<V> {
  readonly value: V;
  readonly label: string;
  readonly disabled?: boolean;
}

/** The button shows the chosen label: its content is that label's tooltip and placeholder. */
export interface DropdownContentParams<Row, V> {
  tooltip?: ContentParams<Row, V>['tooltip'];
  /** Shown when the value matches no option, like `mat-select`. */
  placeholder?: string;
}

export type DropdownCellParams<Row, V, P> = DisplayParams<Row, V, DropdownContentParams<Row, V>> & {
  action: ActionParams<Row, V, P, V> & {
    options: CellRule<Row, V, readonly DropdownOption<V>[]>;
    equals?: (left: V, right: V) => boolean;
  };
};

@Component({
  selector: 'cells-dropdown-cell',
  imports: [CellsTooltip, CellMarker],
  host: { class: 'cells-cell' },
  template: `
    @if (state(); as state) {
      @if (state.marker; as marker) {
        <span [cellsMarker]="marker" [position]="state.tooltipPosition"></span>
      }
      <button
        type="button"
        class="cells-dropdown"
        [class.cells-placeholder]="state.selected === null"
        [attr.aria-label]="state.label"
        [attr.aria-disabled]="state.control.disabled"
        [cellsTooltip]="state.tooltip"
        [cellsTooltipPosition]="state.tooltipPosition"
        [cellsTooltipOverflow]="true"
        (click)="open($event)"
      >
        <span class="cells-dropdown-text">{{ state.text }}</span>
      </button>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DropdownCell<Row, V, P> extends CellBase<Row, V, DropdownCellParams<Row, V, P>> {
  private readonly injector = inject(Injector);

  protected readonly state = computed(() => {
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell) return null;
    const { action, content } = params;
    const options = evaluate(action.options, cell);
    const equals = action.equals ?? Object.is;
    const value = cell.value;
    const selected =
      value == null ? null : (options.find((option) => equals(option.value, value)) ?? null);
    const text = selected?.label ?? content?.placeholder ?? '';
    const { marker, tooltipPosition } = cellDisplay(params, cell);
    const control = cellControl(
      action,
      cell,
      params.context.session,
      params.colDef?.headerName ?? '',
    );
    return {
      marker,
      tooltipPosition,
      control,
      // One element: the control's status or hint first, then the label's own tooltip.
      tooltip: control.tooltip ?? evaluate(content?.tooltip ?? null, cell),
      // Like mat-select, the name says both the field and the current choice.
      label: control.name ? `${control.name}: ${text}` : text,
      options,
      selected,
      text,
    };
  });

  protected open(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    const state = this.state();
    if (!params || !cell || !state || state.control.disabled) return;
    const trigger = event.currentTarget as HTMLElement;
    openCellPopover(
      this.injector,
      trigger,
      DropdownOptions<Row, V>,
      (close) => ({
        ...cellEditorData<Row, V, V>(params, params.action.submit, cell, close),
        options: state.options,
        equals: params.action.equals,
      }),
      // Like mat-select: below the trigger, left-aligned, at least as wide, no arrow.
      {
        placement: 'bottomLeft',
        width: Math.max(trigger.getBoundingClientRect().width, 180),
        arrow: false,
      },
    );
  }
}
