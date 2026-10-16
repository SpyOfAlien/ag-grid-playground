import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CellContent } from './content';
import type { ContentState } from './content';
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CellContent],
  template: '<span [cellContent]="state()">Value</span>',
})
class Harness {
  readonly state = signal<ContentState>({
    alignment: 'end',
    highlighted: true,
    disabled: true,
    ellipsis: true,
    tooltip: 'Full value',
  });
}
describe('CellContent', () => {
  it('binds category styling and removes the tooltip/ellipsis when cleared', async () => {
    const fixture = TestBed.createComponent(Harness);
    await fixture.whenStable();
    const span = (fixture.nativeElement as HTMLElement).querySelector('span')!;
    expect(span.style.textAlign).toBe('end');
    expect(span.classList.contains('grid-cell-highlighted')).toBe(true);
    expect(span.classList.contains('grid-cell-muted')).toBe(true);
    expect(span.title).toBe('Full value');
    fixture.componentInstance.state.update((state) => ({
      ...state,
      tooltip: null,
      ellipsis: false,
    }));
    await fixture.whenStable();
    expect(span.hasAttribute('title')).toBe(false);
    expect(span.classList.contains('grid-cell-ellipsis')).toBe(false);
  });
});
