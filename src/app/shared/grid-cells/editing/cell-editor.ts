import type { Type } from '@angular/core';
import type { CellContext, CellOpenContext } from '../core/cell-context';
import type { EditorPresentations, HostedEditor } from './editor-host/editor-host.model';

export type SaveValue<V> = (value: V) => Promise<void>;
export type CellSave<R, V, Next = V> = (next: Next, cell: CellContext<R, V>) => Promise<void>;

/** Opening data shared by the built-in field editors. */
export interface ValueEditorData<V, C> {
  readonly initialValue: V;
  readonly config: C;
  readonly save: SaveValue<V>;
}

type PresentationOptions<R, V, O> = O | ((cell: CellOpenContext<R, V>) => O);

/** How a cell editor is presented; options can depend on the cell and its trigger. */
export type CellPresentation<R, V> = {
  readonly [K in keyof EditorPresentations]: {
    readonly kind: K;
    readonly options?: PresentationOptions<R, V, EditorPresentations[K]>;
  };
}[keyof EditorPresentations];

export interface CellEditorConfig<R, V, D> {
  readonly component: Type<HostedEditor<D>>;
  readonly data: (cell: CellContext<R, V>) => NoInfer<D>;
  /** Defaults to a popover anchored to the pen button. */
  readonly presentation?: CellPresentation<R, V>;
}
