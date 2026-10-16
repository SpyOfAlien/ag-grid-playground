import type { CellRule } from '../../core/cell-context.model';
import type { CellSave } from '../../editing/editors/value-editor.model';
import type { EditPermission } from '../action/action.model';

export interface ToggleConfig<R, V = boolean> {
  checked?: CellRule<R, V, boolean>;
  permission?: CellRule<R, V, EditPermission>;
  save: CellSave<R, V, boolean>;
}

export interface ToggleState {
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly tooltip: string | null;
}

export interface TogglePart<R, V = boolean> {
  readonly toggle: ToggleConfig<R, V>;
}
