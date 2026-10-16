import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TextCell } from './text-cell';
import type { TextCellParams } from './text-cell-params.model';
import type { GridContext } from '../../core/grid-context.model';
import { rendererParams } from '../../../../../../test-utils/renderer-params';
interface Row {
  name: string;
}
const context: GridContext = {};
describe('TextCell', () => {
  it('renders no children before initialization, then only the content span', async () => {
    const fixture = TestBed.createComponent<TextCell<Row>>(TextCell);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.children.length).toBe(0);
    fixture.componentInstance.agInit(
      rendererParams({ name: 'Hello' }, 'Hello', {} satisfies TextCellParams<Row>, context),
    );
    await fixture.whenStable();
    expect(host.children.length).toBe(1);
    expect(host.firstElementChild?.tagName).toBe('SPAN');
    expect(host.textContent).toBe('Hello');
  });
  it('retains content and updates marker/tooltip on a same-reference metadata refresh', async () => {
    const fixture = TestBed.createComponent<TextCell<Row>>(TextCell);
    const config: TextCellParams<Row> = {
      content: { tooltip: ({ data }) => data?.name ?? null },
      markers: { error: { when: ({ data }) => data?.name === 'Error', tooltip: 'Invalid name' } },
    };
    const params = rendererParams({ name: 'Hello' }, 'same', config, context);
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    const content = host.querySelector('.grid-cell-content');
    params.data!.name = 'Error';
    expect(fixture.componentInstance.refresh(params)).toBe(true);
    await fixture.whenStable();
    expect(host.querySelector('.grid-cell-content')).toBe(content);
    expect(content?.getAttribute('title')).toBe('Error');
    expect(host.children.length).toBe(2);
    expect(host.querySelector('.grid-cell-marker')?.getAttribute('aria-label')).toBe(
      'Error: Invalid name',
    );
    expect(host.textContent).toBe('same');
  });
  it('shares custom text rules and tracks signals, including an explicit empty-value label', async () => {
    const suffix = signal('kg');
    const fixture = TestBed.createComponent<TextCell<Row>>(TextCell);
    const config: TextCellParams<Row> = {
      content: { text: ({ value }) => (value == null ? 'Missing' : `${value} ${suffix()}`) },
    };
    const params = rendererParams({ name: 'A' }, 'Amount', config, context);
    params.valueFormatted = 'Grid formatted';
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const content = root.querySelector('.grid-cell-content');
    expect(content?.textContent).toBe('Amount kg');
    suffix.set('lb');
    await fixture.whenStable();
    expect(content?.textContent).toBe('Amount lb');
    expect(root.querySelector('.grid-cell-content')).toBe(content);
    params.value = null;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect(content?.textContent).toBe('Missing');
    fixture.componentInstance.refresh({ ...params, content: { text: '' } });
    await fixture.whenStable();
    expect(content?.textContent).toBe('');
  });
  it('uses formatted display text and omits stale formatting for missing values', async () => {
    const fixture = TestBed.createComponent<TextCell<Row>>(TextCell);
    const params = rendererParams({ name: 'A' }, 'raw', {}, context);
    params.valueFormatted = 'Formatted';
    fixture.componentInstance.agInit(params);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('Formatted');
    params.value = null;
    fixture.componentInstance.refresh(params);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('');
  });
});
