import type { ColDef, ColGroupDef, SuppressKeyboardEventParams } from 'ag-grid-community';
import { withCellKeyboard, withCellKeyboardColumns } from '../public-api';

interface Row {
  value: number;
}
const event = () =>
  ({ event: new KeyboardEvent('keydown', { key: 'x' }) }) as SuppressKeyboardEventParams<Row>;

describe('Declarative cell keyboard configuration', () => {
  it('preserves application callbacks and returns already composed definitions unchanged', () => {
    const application = vi.fn(() => true);
    const definition: ColDef<Row> = { field: 'value', suppressKeyboardEvent: application };
    const composed = withCellKeyboard(definition);
    expect(composed.suppressKeyboardEvent?.(event())).toBe(true);
    expect(application).toHaveBeenCalledOnce();
    expect(withCellKeyboard(composed)).toBe(composed);
    expect(definition.suppressKeyboardEvent).toBe(application);
  });

  it('configures all leaves in nested groups without mutating definitions or wrapping twice', () => {
    const override = vi.fn(() => false);
    const definitions: (ColDef<Row> | ColGroupDef<Row>)[] = [
      {
        groupId: 'group',
        children: [{ field: 'value' }, { colId: 'override', suppressKeyboardEvent: override }],
      },
    ];
    const columns = withCellKeyboardColumns(definitions);
    const group = columns[0];
    if (!('children' in group)) throw new Error('Expected group');
    for (const column of group.children) {
      if ('children' in column) throw new Error('Expected leaf');
      expect(column.suppressKeyboardEvent).toBeDefined();
      expect(column.suppressKeyboardEvent?.(event())).toBe(false);
    }
    expect(override).toHaveBeenCalledOnce();
    expect(withCellKeyboardColumns(columns)).toBe(columns);
    expect(definitions[0]).not.toBe(group);
    expect('children' in definitions[0] && definitions[0].children[0]).toEqual({ field: 'value' });
  });

  it('inherits default application rules while preserving explicit column overrides', () => {
    const application = vi.fn(() => true);
    const override = vi.fn(() => false);
    const defaults = withCellKeyboard<Row>({ suppressKeyboardEvent: application });
    const columns = withCellKeyboardColumns<Row>(
      [{ field: 'value' }, { colId: 'override', suppressKeyboardEvent: override }],
      defaults,
    );
    const inherited = columns[0] as ColDef<Row>;
    const explicit = columns[1] as ColDef<Row>;
    expect(inherited.suppressKeyboardEvent?.(event())).toBe(true);
    expect(explicit.suppressKeyboardEvent?.(event())).toBe(false);
    expect(application).toHaveBeenCalledOnce();
    expect(override).toHaveBeenCalledOnce();
    expect(withCellKeyboardColumns(columns, defaults)).toBe(columns);
  });

  it('lets controls handle activation even when the application callback returns false', () => {
    const root = document.createElement('div');
    root.className = 'ag-cell';
    root.innerHTML = '<div class="grid-cell"><button>Toggle</button><button>Edit</button></div>';
    document.body.append(root);
    const button = root.querySelector('button')!;
    vi.spyOn(button, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList);
    const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
    button.dispatchEvent(key);
    const application = vi.fn(() => false);
    const column = withCellKeyboard<Row>({ suppressKeyboardEvent: application });
    expect(column.suppressKeyboardEvent?.({ ...event(), event: key })).toBe(true);
    expect(application).toHaveBeenCalledOnce();
    root.remove();
  });

  it('composes new definitions explicitly and leaves input arrays untouched', () => {
    const one: ColDef<Row>[] = [{ field: 'value' }];
    const two: ColDef<Row>[] = [{ field: 'value', width: 240 }];
    const first = withCellKeyboardColumns(one);
    const second = withCellKeyboardColumns(two);
    expect(first).not.toBe(second);
    expect(one[0].suppressKeyboardEvent).toBeUndefined();
    expect(two[0].suppressKeyboardEvent).toBeUndefined();
  });
});
