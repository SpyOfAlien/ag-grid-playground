import { TestBed } from '@angular/core/testing';
import { NumberCell } from './number-cell';
import type { NumberCellParams } from './number-cell-params.model';
import type { GridContext } from '../../core/grid-context.model';
import { rendererParams } from '../../../../../../test-utils/renderer-params';
interface Row {
  unit: string;
}
const context: GridContext = {};
describe('NumberCell', () => {
  it('renders zero and unit in a single span without nested renderers', async () => {
    const fixture = TestBed.createComponent<NumberCell<Row>>(NumberCell);
    const config: NumberCellParams<Row> = {
      content: {
        number: { locale: 'en-US', decimals: 2, unit: 'kg' },
      },
    };
    fixture.componentInstance.agInit(rendererParams({ unit: 'kg' }, 0, config, context));
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.children.length).toBe(1);
    expect(host.firstElementChild?.tagName).toBe('SPAN');
    expect(host.textContent).toBe('0.00 kg');
  });
  it('refreshes units without recreating the span or changing the raw value', async () => {
    const fixture = TestBed.createComponent<NumberCell<Row>>(NumberCell);
    const config: NumberCellParams<Row> = {
      content: {
        number: { locale: 'en-US', decimals: 2, unit: ({ data }) => data?.unit ?? null },
      },
    };
    const params = rendererParams({ unit: 'kg' }, 0, config, context);
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const content = host.firstElementChild;
    params.data!.unit = 'lb';
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect(host.firstElementChild).toBe(content);
    expect(host.textContent).toBe('0.00 lb');
    expect(params.value).toBe(0);
    params.value = null;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect(host.textContent).toBe('');
  });
});
