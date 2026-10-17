import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  type Type,
} from '@angular/core';
import { CellBase, evaluate, type Cell, type CellParams, type CellRule } from '../cell/cell';
import { controlView } from '../cell/control-state';
import { displayView, type DisplayParams } from '../cell/display';
import type { EditParams } from '../cell/edit';
import {
  cellEditorData,
  openCellPopover,
  type CellEditor,
  type CellPopoverOptions,
  type EditorData,
} from '../editors/editor';
import { EDIT_TEMPLATE } from './display-template';

/** The column's editor: its component and any data beyond the standard `EditorData`. */
export interface EditorConfig<Row, V, Next, D extends EditorData<Row, V, Next>> {
  component: Type<CellEditor<D>>;
  data?: (cell: Cell<Row, V>) => Omit<D, keyof EditorData<Row, V, Next>>;
}

/** Shared by popover and dialog cells. */
export type EditCellParams<
  Row,
  V,
  P,
  D extends EditorData<Row, V, Next>,
  M extends string = 'save',
  Next = V,
> = DisplayParams<Row, V> &
  EditParams<Row, V, P, Next, M> & {
    editor: EditorConfig<Row, V, Next, D>;
    /** The pen's accessible name; defaults to "Edit {header}". */
    label?: CellRule<Row, V, string>;
  };

export type PopoverCellParams<
  Row,
  V,
  P,
  D extends EditorData<Row, V, Next>,
  M extends string = 'save',
  Next = V,
> = EditCellParams<Row, V, P, D, M, Next> & { popover?: CellPopoverOptions };

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
  return {
    ...displayView(params, cell),
    pen: controlView({ editable: params.editable }, cell, params.context.session),
    label: params.label
      ? evaluate(params.label, cell)
      : `Edit ${params.colDef?.headerName ?? ''}`.trim(),
  };
}

/** Displays a value and edits it in a popover anchored to the pen. */
@Component({
  selector: 'cells-popover-cell',
  host: { class: 'cells-cell' },
  template: EDIT_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverCell<
  Row,
  V,
  P,
  D extends EditorData<Row, V, Next>,
  M extends string = 'save',
  Next = V,
> extends CellBase<Row, V, PopoverCellParams<Row, V, P, D, M, Next>> {
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
      (close) => ({ ...cellEditorData<Row, V, Next>(params, cell, close), ...data?.(cell) }) as D,
      params.popover,
    );
  }
}
