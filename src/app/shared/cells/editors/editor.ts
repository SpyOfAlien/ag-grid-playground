import type { Injector, InputSignal, Type } from '@angular/core';
import { MatDialog, type MatDialogRef } from '@angular/material/dialog';
import type { Cell } from '../base/base';
import { runCommand, type EditTarget, type RuntimeCommand } from '../base/edit';
import type { CellSession } from '../grid/cells-context';
import type { PopoverPlacement } from '../../popover/popover.model';
import type { PopoverRef } from '../../popover/popover-ref';
import { PopoverService } from '../../popover/popover-service';
import { CellDialog, type CellDialogData } from './cell-dialog';

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

/** The row an editor's data is for. */
export type EditorRow<D extends EditorData<unknown, unknown>> = D['row'];
/** The cell value an editor's data is for. */
export type EditorValue<D extends EditorData<unknown, unknown>> = NonNullable<D['value']>;
/** What an editor submits. */
export type EditorNext<D extends EditorData<unknown, unknown>> = Parameters<D['submit']>[0];

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

/** What an editor works with for a cell; the opener adds `close`. */
export function cellEditorData<Row, V, Next>(
  target: EditTarget,
  command: RuntimeCommand<Row, V, Next> | undefined,
  cell: Cell<Row, V>,
): Omit<EditorData<Row, V, Next>, 'close'> {
  return {
    value: cell.value,
    row: cell.row,
    session: target.context.session,
    submit: (next) => runCommand(target, command, cell, next),
  };
}

/** Opens an editor in a popover anchored to the trigger; it closes after a successful submit. */
export function openCellPopover<D extends EditorData<unknown, unknown>>(
  injector: Injector,
  trigger: HTMLElement,
  component: Type<CellEditor<D>>,
  data: Omit<D, 'close'>,
  options: CellPopoverOptions = {},
): PopoverRef<CellEditor<D>> {
  const ref: PopoverRef<CellEditor<D>> = injector.get(PopoverService).open(component, {
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
    initialize: (content) =>
      content.setInput(
        'data',
        withClose(data, () => ref.close()),
      ),
  });
  return ref;
}

/** Opens an editor in a modal dialog with a title; it closes after a successful submit. */
export function openCellDialog<D extends EditorData<unknown, unknown>>(
  injector: Injector,
  component: Type<CellEditor<D>>,
  data: Omit<D, 'close'>,
  options: CellDialogOptions = {},
): MatDialogRef<CellDialog> {
  const size = (value: number | string | undefined) =>
    typeof value === 'number' ? `${value}px` : value;
  const ref: MatDialogRef<CellDialog> = injector.get(MatDialog).open(CellDialog, {
    injector,
    data: {
      title: options.title ?? 'Edit',
      component,
      data: withClose(data, () => ref.close()),
    } satisfies CellDialogData,
    width: size(options.width),
    height: size(options.height),
    maxWidth: 'calc(100vw - 24px)',
    enterAnimationDuration: 0,
    exitAnimationDuration: 0,
  });
  return ref;
}

/**
 * Adds the host's `close` to an editor's data, and closes after a submit that succeeds. A failed
 * submit rejects and leaves the editor open. `close` runs only after the host has opened.
 */
function withClose<D extends EditorData<unknown, unknown>>(
  data: Omit<D, 'close'>,
  close: () => void,
): D {
  return {
    ...data,
    close,
    submit: async (next: unknown) => {
      await data.submit(next);
      close();
    },
  } as unknown as D;
}
