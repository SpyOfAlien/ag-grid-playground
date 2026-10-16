import { computeAction } from './compute-action';
import type { ActionPart } from './action.model';
import type { CellFacts } from '../../core/cell-context';
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
    expect(computeAction(params)).toEqual({ visible: true, disabled: true, tooltip: 'Locked' });
  });
  it.each([{ data: undefined }, { node: {} }, { node: { id: '' } }])(
    'prevents editing unavailable rows: %j',
    (override) => {
      const permission = vi.fn(() => ({ allowed: true as const }));
      expect(computeAction({ ...base, ...override, action: { permission } })).toEqual({
        visible: true,
        disabled: true,
        tooltip: 'Row is unavailable.',
      });
      expect(permission).not.toHaveBeenCalled();
    },
  );
});
