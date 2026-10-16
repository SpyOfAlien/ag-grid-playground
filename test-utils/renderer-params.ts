import type { GridApi, ICellRendererParams, IRowNode } from 'ag-grid-community';
export function rendererParams<R, V, C, Context>(
  row: R,
  value: V | null,
  config: C,
  context: Context,
): ICellRendererParams<R, V, Context> & C {
  const element = document.createElement('div');
  return {
    ...config,
    data: row,
    value,
    valueFormatted: null,
    api: {} as GridApi<R>,
    node: { id: 'row-1' } as IRowNode<R>,
    context,
    eGridCell: element,
    eParentOfValue: element,
    registerRowDragger: () => undefined,
    setTooltip: () => undefined,
  };
}
