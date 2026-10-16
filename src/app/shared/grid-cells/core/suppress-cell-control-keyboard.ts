import type { SuppressKeyboardEventParams } from 'ag-grid-community';

const CONTROL_SELECTOR = 'button, input, select, textarea, a[href], [tabindex]';
const CONTROL_KEYS = new Set([
  'Enter',
  ' ',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Home',
  'End',
]);

/** Let native controls handle their keys and Tab inside a custom cell; AG Grid owns cell-to-cell navigation. */
export function suppressCellControlKeyboard<R>(
  params: Pick<SuppressKeyboardEventParams<R>, 'event'>,
): boolean {
  const event = params.event;
  if (event.key !== 'Tab' && !CONTROL_KEYS.has(event.key)) return false;
  if (!(event.target instanceof Element)) return false;
  const cell = event.target.closest('.ag-cell');
  const renderer = cell?.querySelector('.grid-cell');
  if (!renderer) return false;
  const control = event.target.closest<HTMLElement>(CONTROL_SELECTOR);
  // Activation/navigation keys need no scan or layout read for the focused control.
  if (event.key !== 'Tab') {
    return (
      control !== null &&
      renderer.contains(control) &&
      control.tabIndex >= 0 &&
      !control.matches(':disabled')
    );
  }
  const controls = Array.from(renderer.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)).filter(
    (element) =>
      element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0,
  );
  const index = control ? controls.indexOf(control) : -1;
  if (event.target === cell) return !event.shiftKey && controls.length > 0;
  return event.shiftKey ? index > 0 : index >= 0 && index < controls.length - 1;
}
