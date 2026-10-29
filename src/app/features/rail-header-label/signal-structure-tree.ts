import type { SignalColumn, SignalGroup, SignalStructureNode } from './signal.model';

interface TreeEntry {
  orderNo: number;
  toNode: (depth: number) => SignalStructureNode;
}

/**
 * Nests columns under their groups and groups under their parents, sorting siblings by
 * orderNo. An unknown groupCode or parentCode puts the item at the top level. Groups in a
 * parent cycle (or their own parent) are never reached from the top and are left out.
 */
export function buildSignalStructureTree(
  groups: SignalGroup[],
  columns: SignalColumn[],
): SignalStructureNode[] {
  const groupCodes = new Set(groups.map((group) => group.code));
  const entriesByParent = new Map<string | null, TreeEntry[]>();
  const add = (parentCode: string | null, entry: TreeEntry) => {
    const key = parentCode && groupCodes.has(parentCode) ? parentCode : null;
    entriesByParent.set(key, [...(entriesByParent.get(key) ?? []), entry]);
  };

  function childrenOf(parentCode: string | null, depth: number): SignalStructureNode[] {
    return [...(entriesByParent.get(parentCode) ?? [])]
      .sort((a, b) => a.orderNo - b.orderNo)
      .map((entry) => entry.toNode(depth));
  }

  for (const column of columns) {
    add(column.groupCode, { orderNo: column.orderNo, toNode: () => ({ kind: 'column', column }) });
  }
  for (const group of groups) {
    add(group.parentCode, {
      orderNo: group.orderNo,
      toNode: (depth) => ({
        kind: 'group',
        group,
        depth,
        children: childrenOf(group.code, depth + 1),
      }),
    });
  }

  return childrenOf(null, 0);
}
