import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellMarker } from './cell-marker';
import { CellBase } from '../base/base';
import {
  cellEditorData,
  openCellDialog,
  type CellDialogOptions,
  type EditorData,
  type EditorNext,
  type EditorRow,
  type EditorValue,
} from '../editors/editor';
import { EDIT_TEMPLATE } from './display-template';
import { editState, type EditAction } from './popover-cell';
import type { DisplayParams } from '../base/display';

export type DialogCellParams<D extends EditorData<unknown, unknown>, P> = DisplayParams<
  EditorRow<D>,
  EditorValue<D>
> & { action: EditAction<D, P> & { dialog?: CellDialogOptions } };

/** Displays a value and edits it in a modal dialog. */
@Component({
  selector: 'cells-dialog-cell',
  imports: [CellsTooltip, CellMarker],
  host: { class: 'cells-cell' },
  template: EDIT_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogCell<D extends EditorData<unknown, unknown>, P> extends CellBase<
  EditorRow<D>,
  EditorValue<D>,
  DialogCellParams<D, P>
> {
  private readonly injector = inject(Injector);

  protected readonly state = computed(() => {
    const params = this.params();
    const cell = this.cell();
    return params && cell ? editState(params, cell) : null;
  });

  protected open(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();

    if (!params || !cell || this.state()?.pen.disabled) return;

    const { editor, submit, dialog } = params.action;
    const { component, data } = editor;

    openCellDialog(
      this.injector,
      component,
      (close) =>
        ({
          ...cellEditorData<EditorRow<D>, EditorValue<D>, EditorNext<D>>(
            params,
            submit,
            cell,
            close,
          ),
          ...data?.(cell),
        }) as D,
      dialog,
    );
  }
}
