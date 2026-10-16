import { DestroyRef, Injector, Signal } from '@angular/core';
import { CellAddress, RowIdentity } from '../model/table-model';
import { EditorSessions, OpenSession } from '../editors/editor-session';
import { OperationController, OperationStatus } from '../operations/operation-controller';
import { TableEditorHost } from '../hosts/editor-host';
import { TableColumn } from '../ag-grid/typed-columns';
export interface TableInteractionContext<R extends RowIdentity> {
  readonly controller: OperationController<R>;
  readonly sessions: EditorSessions<R>;
  readonly host: TableEditorHost;
  readonly injector: Injector;
  readonly owner: DestroyRef;
  readonly focus: (address: CellAddress) => void;
  readonly announceOpen: (outcome: 'already-open' | 'unavailable' | 'denied' | 'busy') => void;
}
export class EditorBinding<R extends RowIdentity, V, C> {
  readonly status: Signal<OperationStatus>;
  readonly release: () => void;
  constructor(
    private readonly context: TableInteractionContext<R>,
    private readonly column: TableColumn<R, V, C>,
    readonly address: CellAddress,
  ) {
    const row = context.controller.model.lookup(address.rowId);
    if (!row || !column.interaction || !column.editor)
      throw new Error('Editor binding requires a data row, interaction and editor');
    const observed = context.controller.observe(column.interaction.target(row));
    this.status = observed.status;
    this.release = observed.release;
  }
  allowed(): boolean {
    const row = this.context.controller.model.lookup(this.address.rowId);
    return !!row && !!this.column.interaction?.permission(row);
  }
  label(): string {
    const row = this.context.controller.model.lookup(this.address.rowId);
    return row ? (this.column.interaction?.label(row) ?? '') : '';
  }
  activate(trigger: HTMLElement): OpenSession<V> | { readonly kind: 'denied' | 'busy' } {
    const row = this.context.controller.model.lookup(this.address.rowId);
    const interaction = this.column.interaction;
    const editor = this.column.editor;
    if (!row || !interaction || !editor || !this.allowed()) {
      this.context.announceOpen('denied');
      return { kind: 'denied' };
    }
    if (this.status().kind === 'pending') {
      this.context.announceOpen('busy');
      return { kind: 'busy' };
    }
    const opened = this.context.sessions.open(
      this.address,
      this.column.value(row),
      interaction.operation,
      interaction.target(row),
      (value) => interaction.command(value, row),
    );
    if (opened.kind !== 'opened') {
      this.context.announceOpen(opened.kind);
      return opened;
    }
    const initialize = (
      component: import('@angular/core').ComponentRef<
        import('../ag-grid/typed-columns').EditorContent<V>
      >,
    ) => component.setInput('session', opened.session);
    if (editor.presentation === 'dialog')
      this.context.host.openDialog(
        editor.content,
        opened.session,
        this.context.injector,
        this.context.owner,
        initialize,
      );
    else
      this.context.host.openPopover(
        editor.content,
        opened.session,
        trigger,
        this.context.injector,
        this.context.owner,
        initialize,
        () => this.context.focus(this.address),
        () => !this.context.sessions.active(),
      );
    return opened;
  }
}
