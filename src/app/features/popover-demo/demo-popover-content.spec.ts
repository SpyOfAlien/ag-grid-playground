import { TestBed } from '@angular/core/testing';
import { DemoPopoverContent } from './demo-popover-content';
import { POPOVER_REF, PopoverRef } from '../../shared/popover/popover-ref';
describe('DemoPopoverContent', () => {
  it('owns its resize and close actions', async () => {
    const dispose = vi.fn();
    const ref = new PopoverRef(dispose);
    TestBed.configureTestingModule({ providers: [{ provide: POPOVER_REF, useValue: ref }] });
    const fixture = TestBed.createComponent(DemoPopoverContent);
    await fixture.whenStable();
    const host = fixture.nativeElement as HTMLElement;
    host.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(host.querySelector('.expanded')).not.toBeNull();
    host.querySelectorAll<HTMLButtonElement>('button')[1].click();
    expect(ref.isClosed()).toBe(true);
  });
});
