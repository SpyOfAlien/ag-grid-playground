import { SuppressKeyboardEventParams } from 'ag-grid-community';
export function tableKeyboard<R>(params: SuppressKeyboardEventParams<R>): boolean {
  const event = params.event;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  const cell = target.closest<HTMLElement>('[role="gridcell"]');
  if (!cell) return false;
  const controls = Array.from(
    cell.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)',
    ),
  ).filter((element) => element.offsetParent !== null);
  const index = controls.indexOf(target);
  if ((event.key === 'Enter' || event.key === 'F2') && index < 0 && controls.length) {
    controls[0].focus();
    event.preventDefault();
    return true;
  }
  if (event.key === 'Escape' && index >= 0) {
    cell.focus();
    event.preventDefault();
    return true;
  }
  if (event.key === 'Tab') {
    const next = index + (event.shiftKey ? -1 : 1);
    if (index >= 0 && next >= 0 && next < controls.length) {
      controls[next].focus();
      event.preventDefault();
      return true;
    }
    // At a cell boundary AG Grid owns logical traversal to the next or previous cell.
    return false;
  }
  return index >= 0 && event.key !== 'Tab';
}
