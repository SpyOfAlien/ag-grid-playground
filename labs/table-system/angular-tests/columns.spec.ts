import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TypedValueCell,
  TypedCellParams,
} from '../../../src/app/shared/table-system/renderers/typed-value-cell';
import { defineColumn } from '../../../src/app/shared/table-system/ag-grid/typed-columns';
import { computeNumber } from '../../../src/app/shared/table-system/presentation/display';
import { fixtures, LabRow } from '../../../src/app/features/table-system-lab/domain/lab-row';
it('default typed rendering reads presentation signals without replacing rows or columns', () => {
  const precision = signal(2);
  const row = fixtures(3)[2];
  const definition = {
    id: 'amount',
    header: 'Amount',
    value: (row: LabRow) => row.amount,
    display: (value: number | null) => computeNumber(value, { decimals: precision(), unit: 'kg' }),
  };
  const column = defineColumn<LabRow>()(definition);
  const view = TestBed.createComponent(TypedValueCell<LabRow, number | null>);
  view.componentInstance.agInit({ data: row, tableColumn: definition } as TypedCellParams<
    LabRow,
    number | null,
    never
  >);
  view.detectChanges();
  expect(view.nativeElement.textContent).toContain('12.35 kg');
  precision.set(3);
  view.detectChanges();
  expect(view.nativeElement.textContent).toContain('12.345 kg');
  expect(column.cellRendererParams.tableColumn).toBe(definition);
  view.destroy();
});
