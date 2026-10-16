import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { GridApi, IRowNode } from 'ag-grid-community';
import type { NumberCellParams } from '../renderers/number/number-cell-params.model';
import type { RendererParams } from './renderer-params.model';
import { BaseCell } from './base-cell';

interface Row {
  id: string;
  amount: number;
}
type Params = RendererParams<Row, number, NumberCellParams<Row>>;
@Component({
  selector: 'test-lifecycle-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<span>{{ value() }}</span><span>{{ unit() }}</span>',
})
class LifecycleCell extends BaseCell<Params> {
  readonly snapshot = this.params;
  readonly value = computed(() => this.params()?.value ?? 'uninitialized');
  readonly unit = computed(() => this.params()?.content?.number?.unit ?? '');
}
function createParams(): Params {
  const element = document.createElement('div');
  return {
    value: 0,
    valueFormatted: null,
    data: { id: 'row-1', amount: 0 },
    // Opaque grid handles: the lifecycle stores them but never calls them.
    api: {} as GridApi<Row>,
    node: {} as IRowNode<Row>,
    context: {},
    eGridCell: element,
    eParentOfValue: element,
    registerRowDragger: () => undefined,
    setTooltip: () => undefined,
    content: {
      number: { unit: 'kg' },
    },
  };
}
describe('BaseCell', () => {
  it('starts with null params before the grid initializes it', async () => {
    const fixture = TestBed.createComponent(LifecycleCell);
    await fixture.whenStable();
    expect(fixture.componentInstance.snapshot()).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('uninitialized');
  });
  it('initializes from a shallow snapshot and preserves grid/row references', async () => {
    const fixture = TestBed.createComponent(LifecycleCell);
    const incoming = createParams();
    fixture.componentInstance.agInit(incoming);
    await fixture.whenStable();
    const snapshot = fixture.componentInstance.snapshot();
    expect(snapshot).not.toBe(incoming);
    expect(snapshot?.data).toBe(incoming.data);
    expect(snapshot?.api).toBe(incoming.api);
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('0kg');
  });
  it('retains the instance and updates the DOM when the same params reference changes', async () => {
    const fixture = TestBed.createComponent(LifecycleCell);
    const cell = fixture.componentInstance;
    const incoming = createParams();
    cell.agInit(incoming);
    await fixture.whenStable();
    const before = cell.snapshot();
    incoming.value = 12;
    expect(cell.refresh(incoming)).toBe(true);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBe(cell);
    expect(cell.snapshot()).not.toBe(before);
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('12kg');
  });
  it('invalidates category consumers on metadata-only refresh with unchanged value', async () => {
    const fixture = TestBed.createComponent(LifecycleCell);
    const incoming = createParams();
    fixture.componentInstance.agInit(incoming);
    await fixture.whenStable();
    incoming.content!.number!.unit = 'lb';
    fixture.componentInstance.refresh(incoming);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('0lb');
  });
});
