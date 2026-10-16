import { computed, Directive, input, output } from '@angular/core';
import {
  columnName,
  evaluateCellRule,
  toCellContext,
  type CellContext,
  type CellFacts,
  type CellRule,
} from '../core/cell-context';
import { DEFAULT_GRID_CELL_LABELS, type GridCellLabels } from '../core/labels';
import type { CellSave } from '../editing/cell-editor';
import type { ContentPart } from './content';
import { computeControlPermission, type EditablePart, type EditPermission } from './permission';
import { IDLE_SAVE, type SaveState } from './save';

export interface ToggleConfig<R, V = boolean> {
  checked?: CellRule<R, V, boolean>;
  /** Replaces the cell-wide `editable` rule for this toggle. */
  permission?: CellRule<R, V, EditPermission>;
  /** Accessible name; defaults to the column header. */
  label?: CellRule<R, V, string>;
  save: CellSave<R, V, boolean>;
}

export interface TogglePart<R, V = boolean> {
  readonly toggle: ToggleConfig<R, V>;
}

export interface ToggleState {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly tooltip: string | null;
  readonly label: string;
}

type ToggleParams<R, V> = CellFacts<R, V> &
  ContentPart<R, V> &
  EditablePart<R, V> &
  TogglePart<R, V>;

export function computeToggle<R, V>(
  params: ToggleParams<R, V> | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
  labels: Pick<GridCellLabels, 'toggle' | 'rowUnavailable'> = DEFAULT_GRID_CELL_LABELS,
): ToggleState | null {
  if (!params || !cell) return null;
  const config = params.toggle;
  const permission = computeControlPermission(params, cell, config.permission, labels);
  return {
    checked: evaluateCellRule(config.checked ?? cell.value === true, cell),
    disabled: !permission.allowed,
    tooltip: permission.allowed
      ? evaluateCellRule(params.content?.tooltip ?? null, cell)
      : permission.reason,
    label: config.label
      ? evaluateCellRule(config.label, cell)
      : columnName(params) || labels.toggle,
  };
}

/** A switch button. It emits the requested next value; the renderer saves it. */
@Directive({
  selector: 'button[cellToggle]',
  host: {
    class: 'grid-cell-toggle',
    type: 'button',
    role: 'switch',
    '[attr.aria-label]': 'state().label',
    '[attr.aria-checked]': 'state().checked',
    '[attr.aria-disabled]': 'unavailable()',
    '[attr.aria-busy]': 'save().pending',
    '[attr.title]': 'tooltip()',
    '(click)': 'activate($event)',
  },
})
export class CellToggle {
  readonly state = input.required<ToggleState>({ alias: 'cellToggle' });
  readonly save = input<SaveState>(IDLE_SAVE, { alias: 'cellToggleSave' });
  readonly toggled = output<boolean>();

  protected readonly unavailable = computed(() => this.state().disabled || this.save().pending);
  // A denial reason outranks a failed save; the failure outranks the ordinary tooltip.
  protected readonly tooltip = computed(() => {
    const state = this.state();
    return state.disabled ? state.tooltip : this.save().error || state.tooltip;
  });

  protected activate(event: MouseEvent): void {
    event.stopPropagation();
    if (!this.unavailable()) this.toggled.emit(!this.state().checked);
  }
}
