import { PopoverRef } from './popover-ref';
describe('PopoverRef', () => {
  it('disposes once and emits/completes the close stream after marking itself closed', () => {
    const dispose = vi.fn();
    const next = vi.fn();
    const complete = vi.fn();
    const ref = new PopoverRef(dispose);
    ref.afterClosed.subscribe({ next, complete });
    ref.close('escape');
    ref.close('backdrop');
    expect(ref.isClosed()).toBe(true);
    expect(dispose).toHaveBeenCalledExactlyOnceWith('escape');
    expect(next).toHaveBeenCalledExactlyOnceWith('escape');
    expect(complete).toHaveBeenCalledTimes(1);
  });
});
