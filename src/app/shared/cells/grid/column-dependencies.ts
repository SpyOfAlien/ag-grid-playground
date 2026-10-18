import type { ColDef, ColGroupDef } from 'ag-grid-community';

/**
 * What a column puts in `ColDef.context`: the row fields or column ids its display depends on
 * besides its own value, such as the field a lock or marker checks. List direct dependencies
 * only; the kit follows chains through columns whose value changed.
 */
export interface CellColumnContext<Row> {
  readonly dependsOn?: readonly ((keyof Row & string) | (string & {}))[];
}

export interface RefreshGraph {
  /** Every declared dependency, for the dev-mode check that each name exists. */
  readonly declared: readonly { readonly column: string; readonly name: string }[];
  /** Columns that depend on this field or column. */
  dependents(name: string): readonly string[];
  /** Every name reachable from these, ignoring whether values change. */
  reachable(names: Iterable<string>): Set<string>;
}

/**
 * Turns each column's `context.dependsOn` into "field → columns that depend on it", once per grid, and
 * rejects cycles. Applying a result then only does lookups.
 */
export function columnDependencyGraph<Row>(
  columnDefs: readonly (ColDef<Row> | ColGroupDef<Row>)[],
): RefreshGraph {
  const edges = new Map<string, string[]>();
  const declared: { column: string; name: string }[] = [];
  for (const column of leaves(columnDefs)) {
    const id = column.colId ?? column.field;
    const dependsOn = (column.context as CellColumnContext<Row> | undefined)?.dependsOn ?? [];
    if (id)
      for (const name of dependsOn) {
        edges.set(name, [...(edges.get(name) ?? []), id]);
        declared.push({ column: id, name });
      }
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (name: string, path: string[]): void => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'visiting')
      throw new Error(`Column dependencies have a cycle: ${[...path, name].join(' → ')}`);
    state.set(name, 'visiting');
    // A column depending on the field of its own name is not a cycle.
    for (const dependent of edges.get(name) ?? [])
      if (dependent !== name) visit(dependent, [...path, name]);
    state.set(name, 'done');
  };
  for (const name of edges.keys()) visit(name, []);
  const dependents = (name: string) => edges.get(name) ?? [];
  return {
    declared,
    dependents,
    reachable(names) {
      const found = new Set<string>();
      const queue = [...names];
      for (let name = queue.shift(); name !== undefined; name = queue.shift())
        for (const dependent of dependents(name))
          if (!found.has(dependent)) {
            found.add(dependent);
            queue.push(dependent);
          }
      return found;
    },
  };
}

function* leaves<Row>(defs: readonly (ColDef<Row> | ColGroupDef<Row>)[]): Generator<ColDef<Row>> {
  for (const def of defs)
    if ('children' in def) yield* leaves(def.children);
    else yield def;
}
