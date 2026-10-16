import type { ColDef, ValueFormatterParams } from 'ag-grid-community';
import { bindPlainCell, cellColumn } from './bind-cell-renderer';
import { NumberCell } from '../renderers/number-cell';

interface Row {
  amount: number | null;
  reviewed: boolean;
}

describe('Column binding helpers', () => {
  it('cellColumn wires the renderer and its params without changing other column options', () => {
    const column = cellColumn<Row>()(NumberCell<Row>, {
      field: 'amount',
      width: 120,
      params: { content: { number: { decimals: 1 } } },
    });
    expect(column).toEqual({
      field: 'amount',
      width: 120,
      cellRenderer: NumberCell,
      cellRendererParams: { content: { number: { decimals: 1 } } },
    });
  });

  it('bindPlainCell formats and styles a read-only column without a renderer', () => {
    const plain: ColDef<Row, number | null> = {
      field: 'amount',
      ...bindPlainCell<Row, number | null>({
        alignment: 'end',
        disabled: ({ data }) => !data?.reviewed,
        tooltip: ({ value }) => (value == null ? null : `Raw ${value}`),
        number: { locale: 'en-US', decimals: 2, unit: 'kg' },
      }),
    };
    const params = (value: number | null, reviewed: boolean) =>
      ({
        value,
        data: { amount: value, reviewed },
        node: { id: 'r1' },
        colDef: plain,
      }) as unknown as ValueFormatterParams<Row, number | null>;
    const formatter = plain.valueFormatter as (
      params: ValueFormatterParams<Row, number | null>,
    ) => string;
    expect(formatter(params(1250, true))).toBe('1,250.00 kg');
    expect(formatter(params(null, true))).toBe('');
    const rules = plain.cellClassRules as Record<string, (params: unknown) => boolean>;
    expect(rules['grid-cell-muted'](params(1, false))).toBe(true);
    expect(rules['grid-cell-muted'](params(1, true))).toBe(false);
    expect((plain.cellStyle as (params: unknown) => object)(params(1, true))).toEqual({
      textAlign: 'end',
    });
    expect((plain.tooltipValueGetter as (params: unknown) => unknown)(params(3, true))).toBe(
      'Raw 3',
    );
  });
});
