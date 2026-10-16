import { it, expect } from 'vitest';
import { GridApi } from 'ag-grid-community';
import { TableProjection } from '../../../src/app/shared/table-system/ag-grid/table-projection';
import { TableModel } from '../../../src/app/shared/table-system/model/table-model';
import {
  fixtures,
  LabRow,
  validateRow,
} from '../../../src/app/features/table-system-lab/domain/lab-row';
it('a rendering exception never rolls back accepted data and reconnect reconstructs it', () => {
  const model = new TableModel('lab', fixtures(2), validateRow);
  const projection = new TableProjection(model);
  const broken = {
    isDestroyed: () => false,
    setGridOption: () => {
      throw new Error('render failed');
    },
  } as unknown as GridApi<LabRow>;
  projection.connect(broken);
  model.commit({ kind: 'patch', rows: [{ id: 'item-0', changes: { amount: 77 } }] });
  projection.sync();
  expect(model.lookup('item-0')?.amount).toBe(77);
  expect(projection.fault()).toBe('render failed');
  let projected: readonly LabRow[] = [];
  const live = {
    isDestroyed: () => false,
    setGridOption: (_key: string, value: readonly LabRow[]) => {
      projected = value;
    },
    getRowNode: () => undefined,
    refreshCells: () => {},
  } as unknown as GridApi<LabRow>;
  projection.disconnect();
  projection.connect(live);
  expect(projected[0].amount).toBe(77);
  expect(projection.fault()).toBe('');
});
