import type { Type } from '@angular/core';
import type { HostedEditor } from '../editor-host/public-api';
import type { CellContext } from '../../core/cell-context.model';

export type SaveValue<V> = (value: V) => Promise<void>;
export type CellSave<R, V, Next = V> = (next: Next, cell: CellContext<R, V>) => Promise<void>;

export interface ValueEditorData<V, C> {
  readonly initialValue: V;
  readonly config: C;
  readonly save: SaveValue<V>;
}

export interface CellEditorConfig<R, V, D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: (cell: CellContext<R, V>) => NoInfer<D>;
}
