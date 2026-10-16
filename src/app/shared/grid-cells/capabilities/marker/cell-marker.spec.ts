import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellMarker } from './cell-marker';
import type { MarkerState } from './marker.model';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellMarker],
  template: '<span [cellMarker]="state()"></span>',
})
class Harness {
  readonly state = signal<MarkerState>({ kind: 'warning', tooltip: 'Review required' });
}
describe('CellMarker', () => {
  it('exposes accessible meaning independently of its CSS symbol and updates it', async () => {
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const span = (fixture.nativeElement as HTMLElement).querySelector('span')!;
    expect(span.getAttribute('role')).toBe('img');
    expect(span.getAttribute('aria-label')).toBe('Warning: Review required');
    expect(span.title).toBe('Review required');
    fixture.componentInstance.state.set({ kind: 'systemGenerated', tooltip: null });
    await fixture.whenStable();
    expect(span.dataset['kind']).toBe('systemGenerated');
    expect(span.getAttribute('aria-label')).toBe('System generated value');
    expect(span.hasAttribute('title')).toBe(false);
    expect(span.children.length).toBe(0);
  });
});
