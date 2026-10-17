import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  type Type,
} from '@angular/core';
import { CellsTooltip } from '../tooltip/tooltip';
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
 * and what the editor submits, so only the persistence `P` and a method other than `save` are added.
 */
export type EditCellParams<
  D extends EditorData<unknown, unknown>,
  P,
  M extends string = 'save',
> = DisplayParams<EditorRow<D>, EditorValue<D>> &
  EditParams<EditorRow<D>, EditorValue<D>, P, EditorNext<D>, M> & {
    editor: EditorConfig<D>;
    /** The pen's accessible name; defaults to "Edit {header}". */
    label?: CellRule<EditorRow<D>, EditorValue<D>, string>;
  };

export type PopoverCellParams<
  D extends EditorData<unknown, unknown>,
  P,
  M extends string = 'save',
> = EditCellParams<D, P, M> & { popover?: CellPopoverOptions };

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
  imports: [CellsTooltip],
  host: { class: 'cells-cell' },
  template: EDIT_TEMPLATE,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PopoverCell<
  D extends EditorData<unknown, unknown>,
  P,
  M extends string = 'save',
> extends CellBase<EditorRow<D>, EditorValue<D>, PopoverCellParams<D, P, M>> {
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
