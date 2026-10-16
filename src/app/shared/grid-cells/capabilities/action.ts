import { Directive, input, output } from '@angular/core';
import {
  columnName,
  evaluateCellRule,
  toCellContext,
  type CellContext,
  type CellFacts,
  type CellOpenContext,
  type CellRule,
} from '../core/cell-context';
import { requireEditorHost, type GridContext } from '../core/grid-context';
import { DEFAULT_GRID_CELL_LABELS, type GridCellLabels } from '../core/labels';
import type { CellEditorConfig } from '../editing/cell-editor';
import type { EditorRef } from '../editing/editor-host/editor-ref';
import type { EditorPresentation } from '../editing/editor-host/editor-host.model';
import { computeControlPermission, type EditablePart, type EditPermission } from './permission';

export interface ActionConfig<R, V> {
  enabled?: boolean;
  /** Replaces the cell-wide `editable` rule for this action. */
  permission?: CellRule<R, V, EditPermission>;
  tooltip?: CellRule<R, V, string | null>;
  /** Accessible name; defaults to the edit label for the column header. */
  label?: CellRule<R, V, string>;
}

export interface ActionPart<R, V, E = never> {
  action?: ActionConfig<R, V> & ([E] extends [never] ? object : { editor: E });
}

export interface ActionState {
  readonly visible: boolean;
  readonly disabled: boolean;
  readonly tooltip: string | null;
  readonly label: string;
}

type ActionParams<R, V> = CellFacts<R, V> & ActionPart<R, V> & EditablePart<R, V>;

export function computeAction<R, V>(
  params: ActionParams<R, V> | null,
  cell: CellContext<R, V> | null = params && toCellContext(params),
  labels: Pick<GridCellLabels, 'editAction' | 'rowUnavailable'> = DEFAULT_GRID_CELL_LABELS,
): ActionState | null {
  if (!params || !cell) return null;
  const action = params.action;
  const label = action?.label
    ? evaluateCellRule(action.label, cell)
    : labels.editAction(columnName(params));
  if (!action || action.enabled === false)
    return { visible: false, disabled: false, tooltip: null, label };
  const permission = computeControlPermission(params, cell, action.permission, labels);
  return {
    visible: true,
    disabled: !permission.allowed,
    tooltip: permission.allowed
      ? evaluateCellRule(action.tooltip ?? null, cell)
      : permission.reason,
    label,
  };
}

/**
 * Opens the action's editor through the feature's host. Callers check the action state first;
 * this only resolves presentation options for the current cell and trigger.
 */
export function openCellEditor<R, V, D>(
  params: CellFacts<R, V> & { readonly context: GridContext } & ActionPart<
      R,
      V,
      CellEditorConfig<R, V, D>
    >,
  trigger: HTMLElement,
): EditorRef | undefined {
  const editor = params.action?.editor;
  if (!editor) return undefined;
  const host = requireEditorHost(params.context);
  const cell: CellOpenContext<R, V> = { ...toCellContext(params), trigger };
  const presentation = editor.presentation ?? { kind: 'popover' };
  const options =
    typeof presentation.options === 'function' ? presentation.options(cell) : presentation.options;
  return host.open(
    { component: editor.component, data: editor.data(cell) },
    // Each kind's resolved options match its kind; TypeScript cannot correlate the union.
    { kind: presentation.kind, options } as EditorPresentation,
    { trigger },
  );
}

/** Applies pen state and guards activation; the renderer delegates opening to its editor host. */
@Directive({
  selector: 'button[cellEditAction]',
  host: {
    class: 'grid-cell-action',
    type: 'button',
    '[attr.aria-label]': 'state().label',
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
