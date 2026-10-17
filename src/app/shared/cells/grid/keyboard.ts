import type { SuppressKeyboardEventParams } from 'ag-grid-community';

const CONTROL = 'button, input, select, textarea, [tabindex="0"]';
// Controls that use arrow keys themselves; buttons do not.
const ARROW_CONTROL = 'input, select, textarea, [role="slider"], [role="spinbutton"]';
const ACTIVATION = new Set(['Enter', ' ']);
const ARROWS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

/**
 * Keys pressed on a control inside a cell renderer stay with that control;
 * AG Grid keeps moving between cells. Set once in `defaultColDef`.
 */
export function suppressCellKeyboard(params: Pick<SuppressKeyboardEventParams, 'event'>): boolean {
  const { key, target, shiftKey } = params.event;
  if (!(target instanceof Element)) return false;
  const gridCell = target.closest('.ag-cell');
  const renderer = gridCell?.querySelector('.cells-cell');
  if (!renderer) return false;
  if (key === 'Tab') return tabStaysInCell(renderer, target, target === gridCell, shiftKey);
  const control = target.closest<HTMLElement>(CONTROL);
  if (!control || !renderer.contains(control)) return false;
  if (ACTIVATION.has(key)) return true;
  if (ARROWS.has(key)) return control.matches(ARROW_CONTROL);
  return false;
}

/** Tab moves through the cell's controls; past either end, AG Grid moves to the next cell. */
function tabStaysInCell(
  renderer: Element,
  target: Element,
  fromCell: boolean,
  backwards: boolean,
): boolean {
  const controls = Array.from(renderer.querySelectorAll<HTMLElement>(CONTROL)).filter(
    (control) => !control.matches(':disabled'),
  );
  if (fromCell) return !backwards && controls.length > 0;
  const index = controls.indexOf(target as HTMLElement);
  if (index < 0) return false;
  return backwards ? index > 0 : index < controls.length - 1;
}
