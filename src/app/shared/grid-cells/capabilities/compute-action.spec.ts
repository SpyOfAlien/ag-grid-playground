import { computeAction } from './action';
import type { ActionPart } from './action';
import type { CellFacts } from '../core/cell-context';
const base: CellFacts<{ editable: boolean }, number> = {
  data: { editable: true },
  value: 1,
  node: { id: 'r1' },
};
describe('Action computation', () => {
  it('has no state before initialization and omits absent or disabled actions', () => {
    expect(computeAction(null)).toBeNull();
    expect(computeAction(base)?.visible).toBe(false);
    expect(computeAction({ ...base, action: { enabled: false } })?.visible).toBe(false);
  });
  it('allows a configured action by default and resolves its tooltip', () => {
    expect(computeAction({ ...base, action: { tooltip: ({ value }) => String(value) } })).toEqual({
      visible: true,
      disabled: false,
      tooltip: '1',
      label: 'Edit value',
    });
  });
  it('uses a denied reason instead of the ordinary tooltip and refreshes from metadata', () => {
    const params: typeof base & ActionPart<{ editable: boolean }, number> = {
      ...base,
      action: {
        permission: ({ data }) =>
          data?.editable ? { allowed: true } : { allowed: false, reason: 'Locked' },
        tooltip: 'Edit',
      },
    };
    expect(computeAction(params)?.disabled).toBe(false);
    params.data!.editable = false;
    expect(computeAction(params)).toMatchObject({
      visible: true,
      disabled: true,
      tooltip: 'Locked',
    });
  });
  it.each([{ data: undefined }, { node: {} }, { node: { id: '' } }])(
    'prevents editing unavailable rows: %j',
    (override) => {
      const permission = vi.fn(() => ({ allowed: true as const }));
      expect(computeAction({ ...base, ...override, action: { permission } })).toEqual({
        visible: true,
        disabled: true,
        tooltip: 'Row is unavailable.',
        label: 'Edit value',
      });
      expect(permission).not.toHaveBeenCalled();
    },
  );

  it('names the action after its column unless a label rule is configured', () => {
    const named = { ...base, colDef: { headerName: 'Amount' }, action: {} };
    expect(computeAction(named)?.label).toBe('Edit Amount');
    expect(
      computeAction({ ...named, action: { label: ({ value }) => `Change ${value}` } })?.label,
    ).toBe('Change 1');
    expect(
      computeAction(named, undefined, {
        editAction: (column) => `Modifier ${column}`,
        rowUnavailable: 'Indisponible',
      })?.label,
    ).toBe('Modifier Amount');
  });
  it('uses the cell-wide editable rule unless the action sets its own permission', () => {
    const editable = { allowed: false as const, reason: 'Cell locked' };
    expect(computeAction({ ...base, editable, action: {} })).toMatchObject({
      disabled: true,
      tooltip: 'Cell locked',
    });
    expect(
      computeAction({ ...base, editable, action: { permission: { allowed: true } } })?.disabled,
    ).toBe(false);
  });
});
