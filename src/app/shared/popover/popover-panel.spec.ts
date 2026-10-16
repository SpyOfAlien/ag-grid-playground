import { TestBed } from '@angular/core/testing';
import { PopoverPanel } from './popover-panel';
describe('PopoverPanel', () => {
  it('exposes an accessible title and decorative arrow without action buttons', async () => {
    const fixture = TestBed.createComponent(PopoverPanel);
    fixture.componentRef.setInput('title', 'Example');
    fixture.componentRef.setInput('titleId', 'example-title');
    fixture.componentInstance.geometry.set({
      placement: 'bottom',
      side: 'bottom',
      arrowOffset: 30,
      arrowVisible: true,
    });
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.getAttribute('aria-labelledby')).toBe('example-title');
    expect(host.querySelector('h2')?.textContent).toBe('Example');
    expect(host.querySelector('.popover-arrow')?.getAttribute('aria-hidden')).toBe('true');
    expect(host.querySelectorAll('button')).toHaveLength(0);
    fixture.componentRef.setInput('title', undefined);
    fixture.componentRef.setInput('arrow', false);
    await fixture.whenStable();
    expect(host.getAttribute('aria-label')).toBe('Popover');
    expect(host.querySelector('.popover-arrow')).toBeNull();
  });
});
