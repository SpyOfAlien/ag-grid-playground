import { ChangeDetectionStrategy, Component, computed, inject, Injector } from '@angular/core';
import { CellBase } from '../cell/cell';
import {
  cellEditorData,
  openCellDialog,
  type CellDialogOptions,
  type EditorData,
} from '../editors/editor';
import { EDIT_TEMPLATE } from './display-template';
import { editView, type EditCellParams } from './popover-cell';

export type DialogCellParams<
  Row,
  V,
  P,
  D extends EditorData<Row, V, Next>,
  M extends string = 'save',
  Next = V,
> = EditCellParams<Row, V, P, D, M, Next> & { dialog?: CellDialogOptions };

/** Displays a value and edits it in a modal dialog. */
@Component({
  selector: 'cells-dialog-cell',
  host: { class: 'cells-cell' },
  template: EDIT_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DialogCell<
  Row,
  V,
  P,
  D extends EditorData<Row, V, Next>,
  M extends string = 'save',
  Next = V,
> extends CellBase<Row, V, DialogCellParams<Row, V, P, D, M, Next>> {
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
      (close) => ({ ...cellEditorData<Row, V, Next>(params, cell, close), ...data?.(cell) }) as D,
      params.dialog,
    );
  }
}
