// BOM only.
import type { Group } from '../tree-table.model';
import { number, text, WHOLE } from './shared/columns';

export function bomStructureCluster(): Group {
  return {
    groupId: 'bomStructureGroup',
    headerName: 'Structure',
    marryChildren: true,
    children: [
      number('level', 'Level', { format: WHOLE }, { initialWidth: 90 }),
      text('partCode', 'Part code', {}, { initialWidth: 130 }),
    ],
  };
}
