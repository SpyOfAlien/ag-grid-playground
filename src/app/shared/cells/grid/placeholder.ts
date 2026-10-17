import type { ColDef } from 'ag-grid-community';

export interface PlaceholderColumn<Row, V> {
  /** The raw value. */
  readonly value: (row: Row) => V | null | undefined;
  /** Text shown and exported instead of the value, or null to render the value. */
  readonly placeholder: (value: V | null | undefined, row: Row) => string | null;
  readonly renderer: unknown;
  readonly params?: object;
}

/**
 * One rule decides per cell whether to show a placeholder. The placeholder becomes the cell value,
 * so exports show exactly what the grid shows, and the renderer is skipped for it.
 */
export function withPlaceholder<Row, V>(
  column: PlaceholderColumn<Row, V>,
): Pick<ColDef<Row>, 'valueGetter' | 'cellRendererSelector'> {
  const placeholder = (row: Row) => column.placeholder(column.value(row), row);
  return {
    valueGetter: ({ data }) => (data ? (placeholder(data) ?? column.value(data)) : null),
    cellRendererSelector: ({ data }) =>
      data && placeholder(data) !== null
        ? undefined
        : { component: column.renderer, params: column.params },
  };
}
