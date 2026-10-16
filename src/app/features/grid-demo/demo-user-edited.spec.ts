import { createDemoUserEditedPredicate } from './demo-user-edited';
const cell = { rowId: 'r1', columnId: 'amount', data: { amount: 0 }, value: 0 };
describe('Demo user-edited predicate', () => {
  it('releases cached identities when the table lifecycle ends', () => {
    const random = vi.fn().mockReturnValueOnce(0.8).mockReturnValue(0.1);
    const predicate = createDemoUserEditedPredicate(random);
    expect(predicate(cell)).toBe(true);
    predicate.clear();
    expect(predicate(cell)).toBe(false);
    expect(random).toHaveBeenCalledTimes(2);
  });
  it('samples once per stable identity across replacement and refresh', () => {
    const random = vi.fn().mockReturnValueOnce(0.8).mockReturnValue(0.1);
    const predicate = createDemoUserEditedPredicate(random);
    expect(predicate(cell)).toBe(true);
    expect(predicate({ ...cell, data: { amount: 20 }, value: 20 })).toBe(true);
    expect(predicate({ ...cell, columnId: 'other' })).toBe(false);
    expect(predicate({ ...cell, rowId: 'r2' })).toBe(false);
    expect(random).toHaveBeenCalledTimes(3);
  });
  it('keeps table instances independent and skips unavailable rows', () => {
    const random = vi.fn(() => 0.8);
    const first = createDemoUserEditedPredicate(random);
    const second = createDemoUserEditedPredicate(random);
    expect(first({ ...cell, data: undefined })).toBe(false);
    expect(first({ ...cell, rowId: undefined })).toBe(false);
    expect(first(cell)).toBe(true);
    expect(second(cell)).toBe(true);
    expect(random).toHaveBeenCalledTimes(2);
  });
});
