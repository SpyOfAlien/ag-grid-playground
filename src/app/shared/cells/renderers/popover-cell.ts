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
import { CellBase, type Cell, type CellParams } from '../base/base';
import { cellControl, type ActionRules } from '../base/control';
import { cellDisplay, type DisplayParams } from '../base/display';
import type { ActionParams } from '../base/edit';
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
 * and what the editor submits, so only the persistence `P` is added. The action owns the editor.
 */
export type EditAction<D extends EditorData<unknown, unknown>, P> = ActionParams<
  EditorRow<D>,
  EditorValue<D>,
  P,
  EditorNext<D>
> & { editor: EditorConfig<D> };

export type PopoverCellParams<D extends EditorData<unknown, unknown>, P> = DisplayParams<
  EditorRow<D>,
  EditorValue<D>
> & { action: EditAction<D, P> & { popover?: CellPopoverOptions } };

/** The state both editing renderers show: the value and a pen. */
export function editState<Row, V>(
  params: CellParams<Row, V, DisplayParams<Row, V> & { action: ActionRules<Row, V> }>,
  cell: Cell<Row, V>,
) {
  const pen = cellControl(
    params.action,
    cell,
    params.context.session,
    params.colDef?.headerName ?? '',
  );
  return { ...cellDisplay(params, cell), pen, label: `Edit ${pen.name}`.trim() };
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

    const { editor, command, popover } = params.action;
    const { component, data } = editor;

    openCellPopover(
      this.injector,
      event.currentTarget as HTMLElement,
      component,
      {
        ...cellEditorData<EditorRow<D>, EditorValue<D>, EditorNext<D>>(params, command, cell),
        ...data?.(cell),
      } as Omit<D, 'close'>,
      popover,
    );
  }
}
