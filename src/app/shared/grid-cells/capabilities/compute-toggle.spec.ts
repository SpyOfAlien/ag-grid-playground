import { computeToggle } from './toggle';
const base = {
  node: { id: 'r1' },
  data: { active: true },
  value: true,
  toggle: { save: async (_next: boolean) => undefined },
};
describe('Toggle computation', () => {
  it('handles initialization and boolean values', () => {
    expect(computeToggle(null)).toBeNull();
    expect(computeToggle(base)).toEqual({
      checked: true,
      disabled: false,
      tooltip: null,
      label: 'Toggle value',
    });
    expect(computeToggle({ ...base, value: null })?.checked).toBe(false);
  });
  it('allows a composite value to supply its own checked rule', () => {
    expect(
      computeToggle({
        ...base,
        value: { active: false },
        toggle: { ...base.toggle, checked: ({ value }) => value?.active ?? false },
      })?.checked,
    ).toBe(false);
  });
  it('distinguishes disabled appearance from permission and displays the denied reason', () => {
    expect(
      computeToggle({ ...base, content: { disabled: true, tooltip: 'Toggle' } }),
    ).toMatchObject({ disabled: false, tooltip: 'Toggle' });
    expect(
      computeToggle({
        ...base,
        toggle: {
          save: base.toggle.save,
          permission: { allowed: false, reason: 'Locked' },
        },
      }),
    ).toMatchObject({ disabled: true, tooltip: 'Locked' });
  });
  it('disables an unavailable row without submitting a change', () => {
    const save = vi.fn(base.toggle.save);
    expect(
      computeToggle<{ active: boolean }, boolean>({
        ...base,
        data: undefined,
        toggle: { save },
      })?.disabled,
    ).toBe(true);
    expect(save).not.toHaveBeenCalled();
  });

  it('uses the cell-wide editable rule unless the toggle sets its own permission', () => {
    const editable = { allowed: false as const, reason: 'Cell locked' };
    expect(computeToggle({ ...base, editable })).toMatchObject({
      disabled: true,
      tooltip: 'Cell locked',
    });
    expect(
      computeToggle({
        ...base,
        editable,
        toggle: { ...base.toggle, permission: { allowed: true } },
      })?.disabled,
    ).toBe(false);
    expect(computeToggle({ ...base, colDef: { headerName: 'Reviewed' } })?.label).toBe('Reviewed');
  });
});
