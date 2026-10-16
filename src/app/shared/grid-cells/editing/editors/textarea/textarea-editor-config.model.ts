import type { FieldEditorConfig } from '../field-editor-config.model';
import type { ValueEditorData } from '../value-editor.model';
export interface TextareaEditorConfig extends FieldEditorConfig {
  readonly rows?: number;
  readonly maxLength?: number;
}
export type TextareaEditorData = ValueEditorData<string, TextareaEditorConfig>;
