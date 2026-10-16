import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellMarker, DEFAULT_MARKER_DEFINITIONS, provideGridCellMarkers } from './marker';
import type { MarkerState } from './marker';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellMarker],
  template: '<span [cellMarker]="state()"></span>',
})
class Harness {
  readonly state = signal<MarkerState>({
    kind: 'warning',
    tooltip: 'Review required',
    additional: [],
  });
}
describe('CellMarker', () => {
  it('exposes accessible meaning independently of its CSS symbol and updates it', async () => {
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const span = (fixture.nativeElement as HTMLElement).querySelector('span')!;
    expect(span.getAttribute('role')).toBe('img');
    expect(span.getAttribute('aria-label')).toBe('Warning: Review required');
    expect(span.title).toBe('Review required');
    fixture.componentInstance.state.set({ kind: 'systemGenerated', tooltip: null, additional: [] });
    await fixture.whenStable();
    expect(span.dataset['kind']).toBe('systemGenerated');
    expect(span.getAttribute('aria-label')).toBe('System generated value');
    expect(span.hasAttribute('title')).toBe(false);
    expect(span.children.length).toBe(0);
  });

  it('describes every active marker while drawing the highest priority one', async () => {
    const fixture = TestBed.createComponent(Harness);
    fixture.componentInstance.state.set({
      kind: 'error',
      tooltip: 'Invalid',
      additional: [
        { kind: 'info', tooltip: 'Imported' },
        { kind: 'special', tooltip: null },
      ],
    });
    await fixture.whenStable();
    const span = (fixture.nativeElement as HTMLElement).querySelector('span')!;
    expect(span.dataset['kind']).toBe('error');
    expect(span.dataset['additional']).toBe('2');
    expect(span.getAttribute('aria-label')).toBe(
      'Error: Invalid; Information: Imported; Special case',
    );
    expect(span.title).toBe('Invalid\nImported');
  });

  it('uses registered labels for added or translated kinds', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideGridCellMarkers([
          { kind: 'warning', label: 'Avertissement' },
          ...DEFAULT_MARKER_DEFINITIONS,
        ]),
      ],
    });
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const span = (fixture.nativeElement as HTMLElement).querySelector('span')!;
    expect(span.getAttribute('aria-label')).toBe('Avertissement: Review required');
  });
});
