import { InputSignal, Type } from '@angular/core';
import { ColDef } from 'ag-grid-community';
import { EditTarget, RowIdentity } from '../model/table-model';
import { Operation } from '../operations/operation-controller';
import { TypedValueCell } from '../renderers/typed-value-cell';
import { Annotation } from '../presentation/display';
import { EditorSession } from '../editors/editor-session';
import { tableKeyboard } from './keyboard';
export interface ColumnInteraction<R extends RowIdentity, V, C> {
  readonly operation: Operation<R, C>;
  readonly target: (row: R) => EditTarget;
  readonly command: (value: V, row: R) => C;
  readonly permission: (row: R) => boolean;
  readonly label: (row: R) => string;
}
export interface EditorContent<V> {
  readonly session: InputSignal<EditorSession<V>>;
}
export interface ColumnEditor<V> {
  readonly content: Type<EditorContent<V>>;
  readonly presentation: 'popover' | 'dialog';
}
export interface TableColumn<R extends RowIdentity, V, C = never> {
  readonly id: string;
  readonly header: string;
  readonly value: (row: R) => V;
  readonly display: (value: NoInfer<V>) => string;
  readonly annotations?: (row: R, value: NoInfer<V>) => readonly Annotation[];
  readonly editor?: ColumnEditor<NoInfer<V>>;
  readonly renderer?: Type<unknown>;
  readonly interaction?: ColumnInteraction<R, NoInfer<V>, C>;
  readonly width?: number;
}
export function defineColumn<R extends RowIdentity>() {
  return <V, C = never>(definition: TableColumn<R, V, C>): ColDef<R, V> => ({
    colId: definition.id,
    headerName: definition.header,
    width: definition.width,
    valueGetter: (params) => (params.data ? definition.value(params.data) : undefined),
    valueFormatter: (params) =>
      params.data ? definition.display(definition.value(params.data)) : String(params.value ?? ''),
    cellRenderer: definition.renderer ?? TypedValueCell,
    cellRendererParams: { tableColumn: definition },
    sortable: true,
    filter: true,
    suppressKeyboardEvent: tableKeyboard,
  });
}
