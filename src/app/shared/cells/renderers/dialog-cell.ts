import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellBase } from '../cell/cell';
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
import { editView, type EditCellParams } from './popover-cell';

export type DialogCellParams<
  D extends EditorData<unknown, unknown>,
  P,
  M extends string = 'save',
> = EditCellParams<D, P, M> & { dialog?: CellDialogOptions };

/** Displays a value and edits it in a modal dialog. */
@Component({
  selector: 'cells-dialog-cell',
  imports: [CellsTooltip],
  host: { class: 'cells-cell' },
  template: EDIT_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogCell<
  D extends EditorData<unknown, unknown>,
  P,
  M extends string = 'save',
> extends CellBase<EditorRow<D>, EditorValue<D>, DialogCellParams<D, P, M>> {
  private readonly injector = inject(Injector);

  protected readonly view = computed(() => {
    const params = this.params();
    const cell = this.cell();
    return params && cell ? editView(params, cell) : null;
  });

  protected open(event: MouseEvent): void {
    event.stopPropagation();
    const params = this.params();
    const cell = this.cell();
    if (!params || !cell || this.view()?.pen.disabled) return;
    const { component, data } = params.editor;
    openCellDialog(
      this.injector,
      component,
      (close) =>
        ({
          ...cellEditorData<EditorRow<D>, EditorValue<D>, EditorNext<D>>(params, cell, close),
          ...data?.(cell),
        }) as D,
      params.dialog,
    );
  }
}
