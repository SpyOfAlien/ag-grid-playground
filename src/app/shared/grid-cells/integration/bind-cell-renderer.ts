import type { Type } from '@angular/core';
import type { ICellRendererParams } from 'ag-grid-community';

/** Only agInit is needed to infer a renderer's configuration, including custom renderers. */
type Renderer = { agInit(params: never): void };

export type CellRendererConfig<C extends Renderer> = Omit<
  Parameters<C['agInit']>[0],
  keyof ICellRendererParams<unknown, unknown, unknown>
>;

/** Bind a fixed renderer once per column, checking its config before AG Grid erases the types. */
export function bindCellRenderer<C extends Renderer>(
  component: Type<C>,
  params: NoInfer<CellRendererConfig<C>>,
): { cellRenderer: Type<C>; cellRendererParams: CellRendererConfig<C> } {
  return { cellRenderer: component, cellRendererParams: params };
}
