import type { FieldEditorConfig } from '../field-editor-config.model';
import type { ValueEditorData } from '../value-editor.model';
export interface InputEditorConfig<V extends string | number> extends FieldEditorConfig {
  readonly mode: V extends number ? 'number' : 'text';
}
export type InputEditorData<V extends string | number> = ValueEditorData<
  V | null,
  InputEditorConfig<V>
>;
