import type { Injector, InputSignal, Type } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import type { Cell } from '../cell/cell';
import { submitEdit, type EditTarget } from '../cell/edit';
import type { CellSession } from '../grid/cell-grid-options';
import type { PopoverPlacement } from '../../popover/popover.model';
import type { PopoverRef } from '../../popover/popover-ref';
import { PopoverService } from '../../popover/popover-service';
import { DialogFrame, type DialogFrameData } from './dialog-frame';

/** What every hosted editor receives, plus any extra data its column adds. */
export interface EditorData<Row, V, Next = V> {
  readonly value: V | null | undefined;
  readonly row: Row;
  /** Sends the edit through the cell's command; resolves after it is saved and closes the editor. */
  submit(next: Next): Promise<void>;
  close(): void;
  /** For anything other than editing this cell, such as calling another persistence method. */
  readonly session: CellSession;
}

export interface CellEditor<D> {
  readonly data: InputSignal<D>;
}

export interface CellPopoverOptions {
  title?: string;
  width?: number | string;
  placement?: PopoverPlacement;
  /** Defaults to true. */
  arrow?: boolean;
}

export interface CellDialogOptions {
  title?: string;
  width?: number | string;
  height?: number | string;
}

/** Builds an editor's data for a cell; `close` closes whatever presents the editor. */
export function cellEditorData<Row, V, Next>(
  params: EditTarget<Row, V, Next>,
  cell: Cell<Row, V>,
  close: () => void,
): EditorData<Row, V, Next> {
  return {
    value: cell.value,
    row: cell.row,
    session: params.context.session,
    close,
    submit: async (next) => {
      await submitEdit(params, cell, next);
      close();
    },
  };
}

/** Opens an editor in a popover anchored to the trigger. */
export function openCellPopover<D>(
  injector: Injector,
  trigger: HTMLElement,
  component: Type<CellEditor<D>>,
  data: (close: () => void) => D,
  options: CellPopoverOptions = {},
): PopoverRef<CellEditor<D>> {
  let ref: PopoverRef<CellEditor<D>> | undefined;
  const close = () => ref?.close();
  ref = injector.get(PopoverService).open(component, {
    trigger,
    injector,
    ariaLabel: options.title ?? 'Edit',
    options: {
      anchor: { kind: 'element', element: trigger },
      placement: options.placement ?? 'bottom',
      backdrop: true,
      title: options.title,
      width: options.width,
      arrow: options.arrow ?? true,
    },
    initialize: (content) => content.setInput('data', data(close)),
  });
  return ref;
}

/** Opens an editor in a modal dialog with a title. */
export function openCellDialog<D>(
  injector: Injector,
  component: Type<CellEditor<D>>,
  data: (close: () => void) => D,
  options: CellDialogOptions = {},
): MatDialogRef<DialogFrame> {
  const size = (value: number | string | undefined) =>
    typeof value === 'number' ? `${value}px` : value;
  let ref: MatDialogRef<DialogFrame> | undefined;
  const close = () => ref?.close();
  ref = injector.get(MatDialog).open(DialogFrame, {
    injector,
    data: {
      title: options.title ?? 'Edit',
      component,
      data: data(close),
    } satisfies DialogFrameData,
    width: size(options.width),
    height: size(options.height),
    maxWidth: 'calc(100vw - 24px)',
    enterAnimationDuration: 0,
    exitAnimationDuration: 0,
  });
  return ref;
}
