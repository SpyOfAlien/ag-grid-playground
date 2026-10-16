import type { CellRule } from '../../core/cell-context.model';
import type { CellSave } from '../../editing/editors/value-editor.model';
import type { EditPermission } from '../action/action.model';
import type { PopoverOptions } from '../../../popover/popover.model';

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
  permission?: CellRule<R, V, EditPermission>;
  save: CellSave<R, V>;
}

export interface DropdownState<V> {
  readonly value: V | null | undefined;
  readonly label: string;
  readonly options: readonly DropdownOption<V>[];
  readonly disabled: boolean;
  readonly tooltip: string | null;
}
