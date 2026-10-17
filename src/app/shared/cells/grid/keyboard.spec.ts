import { suppressCellKeyboard } from './keyboard';

function cell(html: string): HTMLElement {
  const gridCell = document.createElement('div');
  gridCell.className = 'ag-cell';
  gridCell.tabIndex = -1;
  gridCell.innerHTML = `<div class="cells-cell">${html}</div>`;
  document.body.appendChild(gridCell);
  return gridCell;
}

function press(target: Element, key: string, shiftKey = false): boolean {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true });
  Object.defineProperty(event, 'target', { value: target });
  return suppressCellKeyboard({ event });
}

describe('suppressCellKeyboard', () => {
  afterEach(() => (document.body.innerHTML = ''));

  it('leaves Enter and Space to a control inside the cell', () => {
    const button = cell('<button>Edit</button>').querySelector('button')!;

    expect(press(button, 'Enter')).toBe(true);
    expect(press(button, ' ')).toBe(true);
  });

  it('leaves arrow keys to inputs but lets the grid move from buttons', () => {
    const root = cell('<input /><button>Edit</button>');

    expect(press(root.querySelector('input')!, 'ArrowLeft')).toBe(true);
    expect(press(root.querySelector('button')!, 'ArrowLeft')).toBe(false);
  });

  it('ignores keys in cells that are not ours', () => {
    const gridCell = document.createElement('div');
    gridCell.className = 'ag-cell';
    gridCell.innerHTML = '<button>Other</button>';
    document.body.appendChild(gridCell);

    expect(press(gridCell.querySelector('button')!, 'Enter')).toBe(false);
  });

  it('tabs into the cell, between its controls, and back out to the grid', () => {
    const root = cell('<button>Toggle</button><button>Edit</button>');
    const [toggle, edit] = Array.from(root.querySelectorAll('button'));

    expect(press(root, 'Tab')).toBe(true);
    expect(press(toggle, 'Tab')).toBe(true);
    expect(press(edit, 'Tab')).toBe(false);
    expect(press(edit, 'Tab', true)).toBe(true);
    expect(press(toggle, 'Tab', true)).toBe(false);
  });

  it('lets the grid handle Tab on a cell without controls', () => {
    const root = cell('<span>Read only</span>');

    expect(press(root, 'Tab')).toBe(false);
  });
});
