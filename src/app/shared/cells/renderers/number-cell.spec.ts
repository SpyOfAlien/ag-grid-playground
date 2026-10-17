import { TestBed } from '@angular/core/testing';
import { rendererParams, testSession, type Item } from '../testing/cell-test-kit';
import { NumberCell, type NumberCellParams } from './number-cell';

async function text(config: NumberCellParams<Item>, value: number | null) {
  const fixture = TestBed.createComponent(NumberCell<Item>);
  fixture.componentInstance.agInit(rendererParams(testSession(), config, value));
  await fixture.whenStable();
  return (fixture.nativeElement as HTMLElement).querySelector('.cells-text')?.textContent;
}

describe('NumberCell', () => {
  it('formats with locale, decimals, grouping and unit', async () => {
    const number = { locale: 'en-US', decimals: 2, unit: ({ row }: { row: Item }) => row.sku };

    expect(await text({ number }, 1250.5)).toBe('1,250.50 A-1');
    expect(await text({ number }, 0)).toBe('0.00 A-1');
    expect(await text({ number: { locale: 'de-DE', grouping: false } }, 1250.5)).toBe('1250,5');
    expect(await text({ number }, null)).toBe('');
  });

  it('lets a column format replace the number format', async () => {
    expect(
      await text(
        { number: { decimals: 2 }, format: (value) => (value == null ? 'none' : `#${value}`) },
        null,
      ),
    ).toBe('none');
  });
});
