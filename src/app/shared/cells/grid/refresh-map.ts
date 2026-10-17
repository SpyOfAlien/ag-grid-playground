/**
 * For each row field or column id, the columns that must refresh when it changes, even if their
 * own value does not. List direct dependents only; the kit follows the chain through columns
 * whose value changed. Keys are row fields; pass extra column ids as `Columns` to chain through
 * columns that have no field of the same name.
 */
export type RefreshOnChange<Row, Columns extends string = never> = Readonly<
  Partial<Record<(keyof Row & string) | Columns, readonly string[]>>
>;

export interface RefreshGraph {
  dependents(name: string): readonly string[];
  /** Every name reachable from these, ignoring whether values change. */
  reachable(names: Iterable<string>): Set<string>;
  /** Every column name the map refers to. */
  readonly targets: ReadonlySet<string>;
}

/** Resolves the map once and rejects cycles, so applying a result only does lookups. */
export function refreshGraph(
  map: Readonly<Record<string, readonly string[] | undefined>>,
): RefreshGraph {
  const edges = new Map<string, readonly string[]>();
  for (const [name, dependents] of Object.entries(map)) edges.set(name, dependents ?? []);
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (name: string, path: string[]): void => {
    if (state.get(name) === 'done') return;
    if (state.get(name) === 'visiting')
      throw new Error(`refreshOnChange has a cycle: ${[...path, name].join(' → ')}`);
    state.set(name, 'visiting');
    // A field and a column of the same name are one node: listing it is a dependency, not a cycle.
    for (const dependent of edges.get(name) ?? [])
      if (dependent !== name) visit(dependent, [...path, name]);
    state.set(name, 'done');
  };
  for (const name of edges.keys()) visit(name, []);
  const dependents = (name: string) => edges.get(name) ?? [];
  return {
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
    targets: new Set([...edges.values()].flat()),
  };
}
