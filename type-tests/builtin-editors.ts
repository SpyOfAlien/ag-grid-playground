import {
  InputEditor,
  TextareaEditor,
  type InputEditorConfig,
  type InputEditorData,
  type TextareaEditorData,
} from '../src/app/shared/grid-cells/public-api';
import type { EditorDefinition } from '../src/app/shared/grid-cells/editing/editor-host/public-api';
const numeric: EditorDefinition<InputEditorData<number>> = {
  component: InputEditor<number>,
  data: {
    initialValue: 0,
    config: { label: 'Amount', mode: 'number' },
    save: async () => undefined,
  },
};
const notes: EditorDefinition<TextareaEditorData> = {
  component: TextareaEditor,
  data: { initialValue: '', config: { label: 'Notes', rows: 4 }, save: async () => undefined },
};
const wrongMode: InputEditorConfig<number> = {
  label: 'Amount',
  // @ts-expect-error Numeric editors require number mode.
  mode: 'text',
};
const wrongEditor: typeof numeric = {
  // @ts-expect-error Text editor data cannot consume numeric drafts.
  component: InputEditor<string>,
  data: numeric.data,
};
const wrongSave: InputEditorData<number> = {
  ...numeric.data,
  // @ts-expect-error Value saves resolve after commit and cannot return rows.
  save: async () => [{ amount: 1 }],
};
void [notes, wrongMode, wrongEditor, wrongSave];
