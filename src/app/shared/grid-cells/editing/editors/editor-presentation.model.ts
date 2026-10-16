import type { DialogOptions } from '../editor-host/dialog-options.model';
import type { PopoverOptions } from '../../../popover/popover.model';
import type { CellOpenContext } from '../../core/cell-context.model';
import type { CellEditorConfig } from './value-editor.model';

export interface PopoverEditorConfig<R, V, D> extends CellEditorConfig<R, V, D> {
  readonly popover?: PopoverOptions | ((cell: CellOpenContext<R, V>) => PopoverOptions);
}

export interface DialogEditorConfig<R, V, D> extends CellEditorConfig<R, V, D> {
  readonly dialog?: DialogOptions;
}
