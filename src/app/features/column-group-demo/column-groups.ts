import type { ColDef, ColGroupDef } from 'ag-grid-community';

export type ColumnDefinition<R> = ColDef<R> | ColGroupDef<R>;
export type ColumnDropTarget =
  { kind: 'column'; id: string } | { kind: 'group'; id: string; partId?: number };

export function columnId<R>(column: ColDef<R>): string {
  return column.colId ?? column.field ?? '';
}

export function flattenColumns<R>(columns: ColumnDefinition<R>[]): ColDef<R>[] {
  return columns.flatMap((column) =>
    'children' in column ? flattenColumns(column.children) : [column],
  );
}

export function findColumnDefinition<R>(
  columns: ColumnDefinition<R>[],
  target: ColumnDropTarget,
): ColumnDefinition<R> | undefined {
  for (const column of columns) {
    if ('children' in column) {
      if (target.kind === 'group' && column.groupId === target.id) return column;
      const child = findColumnDefinition(column.children, target);
      if (child) return child;
    } else if (target.kind === 'column' && columnId(column) === target.id) return column;
  }
  return undefined;
}

export function columnParent<R>(
  columns: ColumnDefinition<R>[],
  id: string,
): ColGroupDef<R> | undefined {
  for (const column of columns) {
    if (!('children' in column)) continue;
    if (column.children.some((child) => !('children' in child) && columnId(child) === id))
      return column;
    const parent = columnParent(column.children, id);
    if (parent) return parent;
  }
  return undefined;
}

export function canGroupColumn<R>(
  columns: ColumnDefinition<R>[],
  sourceId: string,
  target: ColumnDropTarget,
): boolean {
  if (target.kind === 'column' && sourceId === target.id) return false;
  if (!findColumnDefinition(columns, { kind: 'column', id: sourceId })) return false;
  if (!findColumnDefinition(columns, target)) return false;
  return target.kind !== 'group' || columnParent(columns, sourceId)?.groupId !== target.id;
}

/** Move one leaf into a group header, or create a subgroup around the destination leaf. */
export function groupColumns<R>(
  columns: ColumnDefinition<R>[],
  sourceId: string,
  destination: string | ColumnDropTarget,
): ColumnDefinition<R>[] {
  const target: ColumnDropTarget =
    typeof destination === 'string' ? { kind: 'column', id: destination } : destination;
  if (!canGroupColumn(columns, sourceId, target)) return columns;
  const source = findColumnDefinition(columns, { kind: 'column', id: sourceId });
  if (!source || 'children' in source) return columns;
  const groupId = createGroupId(columns, sourceId, target.id);
  const insert = (definitions: ColumnDefinition<R>[]): ColumnDefinition<R>[] =>
    definitions.map((definition) => {
      if ('children' in definition) {
        if (target.kind === 'group' && definition.groupId === target.id)
          return { ...definition, children: [...definition.children, source] };
        return { ...definition, children: insert(definition.children) };
      }
      return target.kind === 'column' && columnId(definition) === target.id
        ? { groupId, children: [definition, source] }
        : definition;
    });
  return normalizeGroups(insert(removeColumn(columns, sourceId)));
}

export function canCombineGroups<R>(
  columns: ColumnDefinition<R>[],
  sourceId: string,
  targetId: string,
): boolean {
  if (sourceId === targetId) return false;
  const source = findColumnDefinition(columns, { kind: 'group', id: sourceId });
  const target = findColumnDefinition(columns, { kind: 'group', id: targetId });
  if (!source || !target || !('children' in source) || !('children' in target)) return false;
  // An ancestor and its descendant cannot become siblings without losing their hierarchy.
  return (
    !findColumnDefinition(source.children, { kind: 'group', id: targetId }) &&
    !findColumnDefinition(target.children, { kind: 'group', id: sourceId })
  );
}

/** Wrap two complete groups at the destination, retaining their relative order and children. */
export function combineColumnGroups<R>(
  columns: ColumnDefinition<R>[],
  sourceId: string,
  targetId: string,
): ColumnDefinition<R>[] {
  if (!canCombineGroups(columns, sourceId, targetId)) return columns;
  const source = findColumnDefinition(columns, { kind: 'group', id: sourceId });
  const target = findColumnDefinition(columns, { kind: 'group', id: targetId });
  if (!source || !target) return columns;
  const order = flattenColumns(columns);
  const children =
    order.indexOf(flattenColumns([source])[0]) < order.indexOf(flattenColumns([target])[0])
      ? [source, target]
      : [target, source];
  const groupId = createGroupId(columns, sourceId, targetId);
  const remove = (definitions: ColumnDefinition<R>[]): ColumnDefinition<R>[] =>
    definitions.flatMap((definition) => {
      if (!('children' in definition)) return [definition];
      return definition.groupId === sourceId
        ? []
        : [{ ...definition, children: remove(definition.children) }];
    });
  const insert = (definitions: ColumnDefinition<R>[]): ColumnDefinition<R>[] =>
    definitions.map((definition) => {
      if (!('children' in definition)) return definition;
      return definition.groupId === targetId
        ? { groupId, children }
        : { ...definition, children: insert(definition.children) };
    });
  return normalizeGroups(insert(remove(columns)));
}

function createGroupId<R>(
  columns: ColumnDefinition<R>[],
  sourceId: string,
  targetId: string,
): string {
  const groupIds = new Set<string>();
  const collectIds = (definitions: ColumnDefinition<R>[]) => {
    for (const definition of definitions)
      if ('children' in definition) {
        if (definition.groupId) groupIds.add(definition.groupId);
        collectIds(definition.children);
      }
  };
  collectIds(columns);
  const baseId = `group:${targetId}:${sourceId}`;
  let groupId = baseId;
  for (let suffix = 2; groupIds.has(groupId); suffix++) groupId = `${baseId}:${suffix}`;
  return groupId;
}

/** Detach a leaf to the root and preserve the order produced by native dragging. */
export function detachColumn<R>(
  columns: ColumnDefinition<R>[],
  sourceId: string,
  order: string[],
): ColumnDefinition<R>[] {
  if (!columnParent(columns, sourceId)) return columns;
  const source = findColumnDefinition(columns, { kind: 'column', id: sourceId });
  if (!source || 'children' in source) return columns;
  return orderColumns(normalizeGroups([...removeColumn(columns, sourceId), source]), order);
}

/** Remove one level of a chosen group, or remove all groups. */
export function removeColumnGroups<R>(
  columns: ColumnDefinition<R>[],
  groupId?: string,
): ColumnDefinition<R>[] {
  if (!groupId) return flattenColumns(columns);
  return normalizeGroups(
    columns.flatMap((column) => {
      if (!('children' in column)) return [column];
      return column.groupId === groupId
        ? column.children
        : [{ ...column, children: removeColumnGroups(column.children, groupId) }];
    }),
  );
}

export function orderColumns<R>(
  columns: ColumnDefinition<R>[],
  order: string[],
): ColumnDefinition<R>[] {
  const positions = new Map(order.map((id, index) => [id, index]));
  const rank = (column: ColumnDefinition<R>) =>
    Math.min(...flattenColumns([column]).map((leaf) => positions.get(columnId(leaf)) ?? Infinity));
  const sort = (definitions: ColumnDefinition<R>[]): ColumnDefinition<R>[] =>
    definitions
      .map((column) =>
        'children' in column ? { ...column, children: sort(column.children) } : column,
      )
      .sort((a, b) => rank(a) - rank(b));
  return sort(columns);
}

function removeColumn<R>(columns: ColumnDefinition<R>[], id: string): ColumnDefinition<R>[] {
  return columns.flatMap((column) =>
    'children' in column
      ? [{ ...column, children: removeColumn(column.children, id) }]
      : columnId(column) === id
        ? []
        : [column],
  );
}

function normalizeGroups<R>(columns: ColumnDefinition<R>[]): ColumnDefinition<R>[] {
  return columns.flatMap((column) => {
    if (!('children' in column)) return [column];
    const children = normalizeGroups(column.children);
    if (!children.length) return [];
    if (children.length === 1 && !('children' in children[0])) return children;
    return [
      {
        ...column,
        marryChildren: true,
        headerName: flattenColumns(children)
          .map((leaf) => leaf.headerName ?? columnId(leaf))
          .join(' + '),
        children,
      },
    ];
  });
}
