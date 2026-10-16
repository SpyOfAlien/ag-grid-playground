import { Directive, input, output } from '@angular/core';
import {
  columnName,
  evaluateCellRule,
  toCellContext,
  type CellContext,
  type CellFacts,
  type CellRule,
} from '../core/cell-context';
import { DEFAULT_GRID_CELL_LABELS, type GridCellLabels } from '../core/labels';
import type { CellSave, SaveValue } from '../editing/cell-editor';
import type { PopoverOptions } from '../../popover/popover.model';
import type { ContentPart } from './content';
import { computeControlPermission, type EditablePart, type EditPermission } from './permission';

export interface DropdownOption<V> {
  readonly value: V;
  readonly label: string;
  readonly disabled?: boolean;
}

export interface DropdownConfig<R, V> {
  options: CellRule<R, V, readonly DropdownOption<V>[]>;
  placeholder?: string;
  equals?: (left: V, right: V) => boolean;
  popover?: PopoverOptions;
  /** Replaces the cell-wide `editable` rule for this dropdown. */
  permission?: CellRule<R, V, EditPermission>;
  /** Accessible name; defaults to the column header. */
  label?: CellRule<R, V, string>;
  save: CellSave<R, V>;
}

export interface DropdownPart<R, V> {
  dropdown: DropdownConfig<R, V>;
}

export interface DropdownState<V> {
  readonly value: V | null | undefined;
  /** The selected option's label, or the placeholder. */
  readonly text: string;
  /** Accessible name of the trigger, without the selection. */
  readonly label: string;
  readonly options: readonly DropdownOption<V>[];
  readonly disabled: boolean;
  readonly tooltip: string | null;
}

export interface DropdownEditorData<V> {
  readonly initialValue: V | null | undefined;
  readonly options: readonly DropdownOption<V>[];
  readonly equals?: (left: V, right: V) => boolean;
  readonly placeholder?: string;
  readonly save: SaveValue<V>;
}

type DropdownParams<R, V> = CellFacts<R, V> &
  ContentPart<R, V> &
  EditablePart<R, V> &
  DropdownPart<R, V>;

export function computeDropdown<R, V>(
  params: DropdownParams<R, V> | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
  labels: Pick<
    GridCellLabels,
    'dropdown' | 'dropdownPlaceholder' | 'rowUnavailable'
  > = DEFAULT_GRID_CELL_LABELS,
): DropdownState<V> | null {
  if (!params || !cell) return null;
  const config = params.dropdown;
  const options = evaluateCellRule(config.options, cell);
  const permission = computeControlPermission(params, cell, config.permission, labels);
  const value = cell.value;
  const equals = config.equals ?? Object.is;
  const selected =
    value == null ? undefined : options.find((option) => equals(option.value, value));
  return {
    value,
    text: selected?.label ?? config.placeholder ?? labels.dropdownPlaceholder,
    label: config.label
      ? evaluateCellRule(config.label, cell)
      : columnName(params) || labels.dropdown,
    options,
    disabled: !permission.allowed,
    tooltip: permission.allowed
      ? evaluateCellRule(params.content?.tooltip ?? null, cell)
      : permission.reason,
  };
}

/** A trigger that opens the options popover; it emits itself as the anchor. */
@Directive({
  selector: 'button[cellDropdown]',
  host: {
    class: 'grid-cell-dropdown',
    type: 'button',
    'aria-haspopup': 'dialog',
    '[attr.aria-expanded]': 'expanded()',
    '[attr.aria-label]': 'state().label + ": " + state().text',
    '[attr.aria-disabled]': 'state().disabled',
    '[attr.title]': 'state().tooltip',
    '(click)': 'activate($event)',
  },
})
export class CellDropdown<V> {
  readonly state = input.required<DropdownState<V>>({ alias: 'cellDropdown' });
  readonly expanded = input(false, { alias: 'cellDropdownExpanded' });
  readonly opened = output<HTMLElement>();

  protected activate(event: MouseEvent): void {
    event.stopPropagation();
    const trigger = event.currentTarget;
    if (!this.state().disabled && !this.expanded() && trigger instanceof HTMLElement)
      this.opened.emit(trigger);
  }
}
