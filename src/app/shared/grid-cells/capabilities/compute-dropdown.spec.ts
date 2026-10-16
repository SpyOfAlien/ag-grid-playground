import { computeDropdown } from './dropdown';
const options = [
  { value: 0, label: 'Zero', disabled: true },
  { value: 1, label: 'One' },
];
const base = {
  node: { id: 'r1' },
  data: { selected: 0 },
  value: 0,
  dropdown: {
    options,
    placeholder: 'Choose',
    save: async (_next: number) => undefined,
  },
};
describe('Dropdown computation', () => {
  it('handles initialization and selects zero with default equality', () => {
    expect(computeDropdown(null)).toBeNull();
    expect(computeDropdown(base)).toEqual({
      value: 0,
      text: 'Zero',
      label: 'Dropdown value',
      options,
      disabled: false,
      tooltip: null,
    });
    expect(computeDropdown(base)?.options).toBe(options);
  });
  it.each([null, undefined, 99])(
    'uses the placeholder for missing or unmatched value %s',
    (value) => expect(computeDropdown({ ...base, value })?.text).toBe('Choose'),
  );
  it('supports object equality and callback options', () => {
    const first = { id: 1 };
    const value = { id: 1 };
    const config = {
      options: [{ value: first, label: 'First' }],
      equals: (a: typeof first, b: typeof first) => a.id === b.id,
      save: async (_next: typeof first) => undefined,
    };
    const params = { node: { id: 'r1' }, data: { selected: value }, value, dropdown: config };
    expect(computeDropdown(params)?.text).toBe('First');
    // Without a placeholder, an unmatched value still gives the trigger visible text.
    expect(computeDropdown({ ...params, dropdown: { ...config, equals: undefined } })?.text).toBe(
      'Choose a value',
    );
    expect(
      computeDropdown({
        ...base,
        dropdown: { ...base.dropdown, options: ({ data }) => (data ? options : []) },
      })?.options,
    ).toBe(options);
  });
  it('keeps disabled options separate from control permission and uses denial reasons', () => {
    expect(computeDropdown(base)?.disabled).toBe(false);
    expect(
      computeDropdown({
        ...base,
        dropdown: {
          ...base.dropdown,
          permission: { allowed: false, reason: 'Locked' },
        },
      }),
    ).toMatchObject({ disabled: true, tooltip: 'Locked' });
    expect(computeDropdown({ ...base, node: {} })?.disabled).toBe(true);
  });

  it('names the trigger after its column and falls back to the cell-wide editable rule', () => {
    expect(computeDropdown({ ...base, colDef: { headerName: 'Unit' } })?.label).toBe('Unit');
    expect(
      computeDropdown({ ...base, dropdown: { ...base.dropdown, label: 'Measurement unit' } })
        ?.label,
    ).toBe('Measurement unit');
    expect(
      computeDropdown({ ...base, editable: { allowed: false, reason: 'Cell locked' } }),
    ).toMatchObject({ disabled: true, tooltip: 'Cell locked' });
  });
});
