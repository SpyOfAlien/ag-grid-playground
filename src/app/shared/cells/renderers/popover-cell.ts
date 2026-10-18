import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  type Type,
} from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
import { CellMarker } from './cell-marker';
import { CellBase, evaluate, type Cell, type CellParams, type CellRule } from '../base/base';
import { cellControl } from '../base/control';
import { cellDisplay, type DisplayParams } from '../base/display';
import type { EditParams } from '../base/edit';
import {
  cellEditorData,
  openCellPopover,
  type CellEditor,
  type CellPopoverOptions,
  type EditorData,
  type EditorNext,
  type EditorRow,
  type EditorValue,
} from '../editors/editor';
import { EDIT_TEMPLATE } from './display-template';

/** The column's editor: its component and any data beyond the standard `EditorData`. */
export interface EditorConfig<D extends EditorData<unknown, unknown>> {
  component: Type<CellEditor<D>>;
  data?: (cell: Cell<EditorRow<D>, EditorValue<D>>) => Omit<D, keyof EditorData<unknown, unknown>>;
}

/**
 * Shared by popover and dialog cells. The editor's data `D` already says the row, the cell value
 * and what the editor submits, so only the persistence `P` is added.
 */
export type EditCellParams<D extends EditorData<unknown, unknown>, P> = DisplayParams<
  EditorRow<D>,
  EditorValue<D>
> &
  EditParams<EditorRow<D>, EditorValue<D>, P, EditorNext<D>> & {
    editor: EditorConfig<D>;
  };

export type PopoverCellParams<D extends EditorData<unknown, unknown>, P> = EditCellParams<D, P> & {
  popover?: CellPopoverOptions;
};

/** The view both editing renderers show: the value and a pen. */
export function editView<Row, V>(
  params: CellParams<
    Row,
    V,
    DisplayParams<Row, V> & {
      editable?: CellRule<Row, V, true | string>;
      label?: CellRule<Row, V, string>;
    }
  >,
  cell: Cell<Row, V>,
) {
  const pen = cellControl(
    { editable: params.editable, label: params.label },
    cell,
    params.context.session,
    `Edit ${params.colDef?.headerName ?? ''}`.trim(),
  );
  return { ...cellDisplay(params, cell), pen, label: pen.label };
}

/** Displays a value and edits it in a popover anchored to the pen. */
@Component({
  selector: 'cells-popover-cell',
  imports: [CellsTooltip, CellMarker],
  host: { class: 'cells-cell' },
  template: EDIT_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverCell<D extends EditorData<unknown, unknown>, P> extends CellBase<
  EditorRow<D>,
  EditorValue<D>,
  PopoverCellParams<D, P>
> {
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
    openCellPopover(
      this.injector,
      event.currentTarget as HTMLElement,
      component,
      (close) =>
        ({
          ...cellEditorData<EditorRow<D>, EditorValue<D>, EditorNext<D>>(params, cell, close),
          ...data?.(cell),
        }) as D,
      params.popover,
    );
  }
}
