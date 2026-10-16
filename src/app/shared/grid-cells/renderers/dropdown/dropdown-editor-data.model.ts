import type { SaveValue } from '../../editing/editors/value-editor.model';
import type { DropdownOption } from '../../capabilities/dropdown/dropdown.model';
export interface DropdownEditorData<V> {
  readonly initialValue: V | null | undefined;
  readonly options: readonly DropdownOption<V>[];
  readonly equals?: (left: V, right: V) => boolean;
  readonly placeholder?: string;
  readonly save: SaveValue<V>;
}
