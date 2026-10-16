import { suppressCellControlKeyboard } from './suppress-cell-control-keyboard';

describe('Cell control keyboard handling', () => {
  function setup() {
    const cell = document.createElement('div');
    cell.className = 'ag-cell';
    cell.tabIndex = 0;
    cell.innerHTML = `<div class="grid-cell"><button><span>Toggle</span></button>
      <button disabled>Disabled</button><button hidden>Hidden</button><button>Edit</button></div>`;
    document.body.append(cell);
    const renderer = cell.querySelector<HTMLElement>('.grid-cell')!;
    const buttons = Array.from(renderer.querySelectorAll('button'));
    const reads = buttons.map((button) =>
      vi.spyOn(button, 'getClientRects').mockImplementation(() => {
        const rectangles = button.hidden ? [] : [new DOMRect(0, 0, 20, 20)];
        return Object.assign(rectangles, { item: (index: number) => rectangles[index] ?? null });
      }),
    );
    const handle = (target: Element, key: string, shiftKey = false) => {
      const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true });
      target.dispatchEvent(event);
      // The grid callback only consumes the native event.
      return suppressCellControlKeyboard({ event });
    };
    return { cell, renderer, buttons, reads, handle };
  }

  afterEach(() => document.body.replaceChildren());

  it('leaves unrelated keys alone without scanning controls or reading layout', () => {
    const { renderer, buttons, reads, handle } = setup();
    const scan = vi.spyOn(renderer, 'querySelectorAll');
    expect(handle(buttons[0], 'a')).toBe(false);
    expect(handle(buttons[0], 'Escape')).toBe(false);
    expect(scan).not.toHaveBeenCalled();
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it('handles control descendants without layout reads and leaves grid navigation intact', () => {
    const { cell, renderer, buttons, reads, handle } = setup();
    const scan = vi.spyOn(renderer, 'querySelectorAll');
    expect(handle(buttons[0].querySelector('span')!, 'Enter')).toBe(true);
    expect(handle(buttons[0], 'ArrowRight')).toBe(true);
    expect(handle(buttons[1], 'Enter')).toBe(false);
    expect(handle(cell, 'ArrowRight')).toBe(false);
    expect(scan).not.toHaveBeenCalled();
    for (const read of reads) expect(read).not.toHaveBeenCalled();
  });

  it('keeps Tab inside visible controls and releases it at either edge', () => {
    const { cell, buttons, handle } = setup();
    expect(handle(cell, 'Tab')).toBe(true);
    expect(handle(cell, 'Tab', true)).toBe(false);
    expect(handle(buttons[0], 'Tab')).toBe(true);
    expect(handle(buttons[0], 'Tab', true)).toBe(false);
    expect(handle(buttons[3], 'Tab')).toBe(false);
    expect(handle(buttons[3], 'Tab', true)).toBe(true);
    buttons[3].hidden = true;
    expect(handle(buttons[0], 'Tab')).toBe(false);
  });
});
