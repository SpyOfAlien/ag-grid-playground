import type { ColDef } from 'ag-grid-community';

export interface EmptyStateColumn<Row, V> {
  /** The raw value. */
  readonly value: (row: Row) => V | null | undefined;
  /** Text shown and exported instead of the value, such as `-` or `NA`, or null to render the value. */
  readonly emptyState: (value: V | null | undefined, row: Row) => string | null;
  readonly renderer: unknown;
  readonly params?: object;
}

/**
 * One rule decides per cell whether to show an empty state. The empty state becomes the cell
 * value, so exports show exactly what the grid shows, and the renderer is skipped for it.
 */
export function withEmptyState<Row, V>(
  column: EmptyStateColumn<Row, V>,
): Pick<ColDef<Row>, 'valueGetter' | 'cellRendererSelector'> {
  const emptyState = (row: Row) => column.emptyState(column.value(row), row);
  return {
    valueGetter: ({ data }) => (data ? (emptyState(data) ?? column.value(data)) : null),
    cellRendererSelector: ({ data }) =>
      data && emptyState(data) !== null
        ? undefined
        : { component: column.renderer, params: column.params },
  };
}
