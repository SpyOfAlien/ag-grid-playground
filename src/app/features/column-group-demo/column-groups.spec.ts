import { describe, expect, it } from 'vitest';
import {
  canCombineGroups,
  canGroupColumn,
  columnId,
  columnParent,
  combineColumnGroups,
  detachColumn,
  findColumnDefinition,
  flattenColumns,
  groupColumns,
  orderColumns,
  removeColumnGroups,
  type ColumnDefinition,
} from './column-groups';

const columns: ColumnDefinition<unknown>[] = ['a', 'b', 'c', 'd', 'e', 'f'].map((colId) => ({
  colId,
}));
const ids = (definitions: ColumnDefinition<unknown>[]) => flattenColumns(definitions).map(columnId);

describe('column grouping', () => {
  it('combines complete groups under a new parent without changing their relative order or leaf state', () => {
    const sorted = { colId: 'a', width: 175, sort: 'asc' as const, pinned: 'left' as const };
    const grouped: ColumnDefinition<unknown>[] = [
      { groupId: 'first', children: [sorted, columns[1]] },
      { groupId: 'second', children: columns.slice(2, 4) },
      ...columns.slice(4),
    ];
    for (const [source, target] of [
      ['first', 'second'],
      ['second', 'first'],
    ]) {
      const result = combineColumnGroups(grouped, source, target);
      expect(result[0]).toMatchObject({
        marryChildren: true,
        children: [
          { groupId: 'first', children: [sorted, columns[1]] },
          { groupId: 'second', children: columns.slice(2, 4) },
        ],
      });
      expect(findColumnDefinition(result, { kind: 'column', id: 'a' })).toBe(sorted);
      expect(ids(result)).toEqual(ids(grouped));
      expect(removeColumnGroups(result, `group:${target}:${source}`)).toMatchObject(grouped);
    }
    expect(grouped).toHaveLength(4);
    expect(grouped[0]).toEqual({ groupId: 'first', children: [sorted, columns[1]] });
  });

  it('combines nested groups across branches, preserving their siblings and cleaning the source parent', () => {
    const grouped: ColumnDefinition<unknown>[] = [
      {
        groupId: 'outerA',
        children: [{ groupId: 'first', children: columns.slice(0, 2) }, columns[2]],
      },
      {
        groupId: 'outerB',
        children: [{ groupId: 'second', children: columns.slice(3, 5) }, columns[5]],
      },
    ];
    const result = combineColumnGroups(grouped, 'first', 'second');
    expect(result).toMatchObject([
      columns[2],
      {
        groupId: 'outerB',
        children: [
          {
            children: [
              { groupId: 'first', children: columns.slice(0, 2) },
              { groupId: 'second', children: columns.slice(3, 5) },
            ],
          },
          columns[5],
        ],
      },
    ]);
    expect(ids(result)).toEqual(['c', 'a', 'b', 'd', 'e', 'f']);
    expect(ids(grouped)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('lets sibling groups create another nested level with a distinct group ID', () => {
    const grouped: ColumnDefinition<unknown>[] = [
      {
        groupId: 'group:second:first',
        children: [
          { groupId: 'first', children: columns.slice(0, 2) },
          { groupId: 'second', children: columns.slice(2, 4) },
        ],
      },
      ...columns.slice(4),
    ];
    const result = combineColumnGroups(grouped, 'first', 'second');
    expect(result[0]).toMatchObject({
      groupId: 'group:second:first',
      children: [
        {
          groupId: 'group:second:first:2',
          children: [{ groupId: 'first' }, { groupId: 'second' }],
        },
      ],
    });
    expect(ids(result)).toEqual(ids(grouped));
  });

  it('rejects group self drops, missing groups and ancestor/descendant combinations without mutating the tree', () => {
    const grouped: ColumnDefinition<unknown>[] = [
      {
        groupId: 'outer',
        children: [{ groupId: 'inner', children: columns.slice(0, 2) }, columns[2]],
      },
      ...columns.slice(3),
    ];
    for (const [source, target] of [
      ['outer', 'outer'],
      ['outer', 'inner'],
      ['inner', 'outer'],
      ['missing', 'outer'],
      ['outer', 'missing'],
    ]) {
      expect(canCombineGroups(grouped, source, target)).toBe(false);
      expect(combineColumnGroups(grouped, source, target)).toBe(grouped);
    }
    expect(ids(grouped)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('places a group at the target and keeps other columns in order without mutating input', () => {
    const result = groupColumns(columns, 'a', 'c');
    expect(ids(result)).toEqual(['b', 'c', 'a', 'd', 'e', 'f']);
    expect(columns).toHaveLength(6);
    expect(result[1]).toMatchObject({ children: [columns[2], columns[0]], marryChildren: true });
  });

  it('moves only the dragged column into an existing group', () => {
    const grouped: ColumnDefinition<unknown>[] = [
      { groupId: 'first', children: columns.slice(0, 3) },
      { groupId: 'second', children: columns.slice(3) },
    ];
    const result = groupColumns(grouped, 'a', { kind: 'group', id: 'second' });
    expect(result).toMatchObject([
      { groupId: 'first', children: [{ colId: 'b' }, { colId: 'c' }] },
      {
        groupId: 'second',
        children: [{ colId: 'd' }, { colId: 'e' }, { colId: 'f' }, { colId: 'a' }],
      },
    ]);
    expect(ids(result)).toEqual(['b', 'c', 'd', 'e', 'f', 'a']);
    expect(ids(grouped)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('creates a subgroup at a child column, preserving its parent and siblings', () => {
    const grouped = groupColumns(columns, 'b', 'a');
    const result = groupColumns(grouped, 'c', 'a');
    expect(result[0]).toMatchObject({
      groupId: 'group:a:b',
      headerName: 'a + c + b',
      children: [{ children: [{ colId: 'a' }, { colId: 'c' }] }, { colId: 'b' }],
    });
    expect(ids(result)).toEqual(['a', 'c', 'b', 'd', 'e', 'f']);
  });

  it('allows siblings to form a subgroup with a distinct group ID', () => {
    const grouped = groupColumns(columns, 'b', 'a');
    const result = groupColumns(grouped, 'b', 'a');
    expect(result[0]).toMatchObject({
      groupId: 'group:a:b',
      children: [{ groupId: 'group:a:b:2', children: [{ colId: 'a' }, { colId: 'b' }] }],
    });
    expect(ids(result)).toEqual(ids(grouped));
  });

  it('moves a nested column to its ancestor group and removes its redundant single-leaf group', () => {
    const grouped = groupColumns(groupColumns(columns, 'b', 'a'), 'c', 'a');
    const result = groupColumns(grouped, 'c', { kind: 'group', id: 'group:a:b' });
    expect(result[0]).toMatchObject({ children: [{ colId: 'a' }, { colId: 'b' }, { colId: 'c' }] });
    expect(columnParent(result, 'c')?.groupId).toBe('group:a:b');
  });

  it('detaches a column at its native position, keeping its remaining siblings together', () => {
    const grouped: ColumnDefinition<unknown>[] = [
      { groupId: 'first', children: columns.slice(0, 3) },
      ...columns.slice(3),
    ];
    const result = detachColumn(grouped, 'a', ['b', 'c', 'd', 'a', 'e', 'f']);
    expect(ids(result)).toEqual(['b', 'c', 'd', 'a', 'e', 'f']);
    expect(result).toHaveLength(5);
    expect(columnParent(result, 'a')).toBeUndefined();
    expect(columnParent(result, 'b')?.groupId).toBe('first');
  });

  it('cleans up empty and single-leaf groups after detaching a nested column', () => {
    const grouped = groupColumns(groupColumns(columns, 'b', 'a'), 'c', 'a');
    const result = detachColumn(grouped, 'a', ['c', 'b', 'd', 'a', 'e', 'f']);
    expect(result[0]).toMatchObject({
      groupId: 'group:a:b',
      children: [{ colId: 'c' }, { colId: 'b' }],
    });
    expect(columnParent(result, 'a')).toBeUndefined();
    expect(ids(result)).toEqual(['c', 'b', 'd', 'a', 'e', 'f']);
  });

  it('ungroups a nested level without destroying other subgroups, and supports ungroup all', () => {
    const grouped = groupColumns(groupColumns(groupColumns(columns, 'b', 'a'), 'c', 'a'), 'd', 'b');
    const nested = columnParent(grouped, 'c');
    const result = removeColumnGroups(grouped, nested?.groupId);
    expect(result[0]).toMatchObject({
      children: [{ colId: 'a' }, { colId: 'c' }, { children: [{ colId: 'b' }, { colId: 'd' }] }],
    });
    expect(ids(result)).toEqual(ids(grouped));
    expect(removeColumnGroups(grouped)).toEqual(flattenColumns(grouped));
  });

  it('rejects missing targets, self drops and adding a direct child to its existing parent', () => {
    expect(groupColumns(columns, 'missing', 'a')).toBe(columns);
    expect(groupColumns(columns, 'a', 'missing')).toBe(columns);
    expect(groupColumns(columns, 'a', 'a')).toBe(columns);
    const grouped = groupColumns(columns, 'a', 'b');
    expect(canGroupColumn(grouped, 'a', { kind: 'group', id: 'group:b:a' })).toBe(false);
    expect(groupColumns(grouped, 'a', { kind: 'group', id: 'group:b:a' })).toBe(grouped);
    expect(groupColumns(grouped, 'a', { kind: 'group', id: 'missing' })).toBe(grouped);
  });

  it('keeps nested groups intact when synchronizing native order and retaining column state', () => {
    const sorted = { colId: 'a', sort: 'asc' as const, width: 150, pinned: 'left' as const };
    const grouped = groupColumns(groupColumns([sorted, ...columns.slice(1)], 'b', 'a'), 'c', 'a');
    const result = orderColumns(grouped, ['d', 'b', 'c', 'a', 'e', 'f']);
    expect(ids(result)).toEqual(['d', 'b', 'c', 'a', 'e', 'f']);
    expect(findColumnDefinition(result, { kind: 'column', id: 'a' })).toBe(sorted);
    expect(result[1]).toMatchObject({
      children: [{ colId: 'b' }, { children: [{ colId: 'c' }, sorted] }],
    });
  });
});
