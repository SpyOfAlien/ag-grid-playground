import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PopoverDemo } from './popover-demo';
describe('PopoverDemo', () => {
  it('renders twelve placement triggers without mounting popover content', async () => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(PopoverDemo);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.placements button').length).toBe(12);
    expect(host.querySelector('app-demo-popover-content')).toBeNull();
  });
});
