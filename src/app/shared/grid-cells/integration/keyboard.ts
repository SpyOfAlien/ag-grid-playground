import type { ColDef, ColGroupDef, SuppressKeyboardEventParams } from 'ag-grid-community';

const CONTROL_SELECTOR = 'button, input, select, textarea, a[href], [tabindex]';
const ACTIVATION_KEYS = new Set(['Enter', ' ']);
const NAVIGATION_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);
// Controls that move a caret or selection with navigation keys. Buttons and links do not.
const NAVIGATING_CONTROL = [
  'input:not([type="button"], [type="checkbox"], [type="submit"], [type="reset"], [type="image"])',
  'select',
  'textarea',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="slider"]',
  '[role="spinbutton"]',
  '[role="listbox"]',
  '[role="combobox"]',
  '[role="radiogroup"]',
].join(', ');

function usable(control: HTMLElement): boolean {
  return control.tabIndex >= 0 && !control.matches(':disabled');
}

/** Let native controls handle their keys and Tab inside a custom cell; AG Grid owns cell-to-cell navigation. */
export function suppressCellControlKeyboard<R>(
  params: Pick<SuppressKeyboardEventParams<R>, 'event'>,
): boolean {
  const event = params.event;
  const key = event.key;
  const tab = key === 'Tab';
  if (!tab && !ACTIVATION_KEYS.has(key) && !NAVIGATION_KEYS.has(key)) return false;
  if (!(event.target instanceof Element)) return false;
  const cell = event.target.closest('.ag-cell');
  const renderer = cell?.querySelector('.grid-cell');
  if (!renderer) return false;
  const control = event.target.closest<HTMLElement>(CONTROL_SELECTOR);
  // Activation and navigation keys need no scan or layout read for the focused control.
  if (!tab) {
    if (control === null || !renderer.contains(control) || !usable(control)) return false;
    return ACTIVATION_KEYS.has(key) || control.matches(NAVIGATING_CONTROL);
  }
  const controls = Array.from(renderer.querySelectorAll<HTMLElement>(CONTROL_SELECTOR)).filter(
    (element) => usable(element) && element.getClientRects().length > 0,
  );
  const index = control ? controls.indexOf(control) : -1;
  if (event.target === cell) return !event.shiftKey && controls.length > 0;
  return event.shiftKey ? index > 0 : index >= 0 && index < controls.length - 1;
}

// Mark composed callbacks so applying the helper again cannot nest the kit behavior.
const composed = Symbol('cellKeyboard');
type KeyboardRule<R> = NonNullable<ColDef<R>['suppressKeyboardEvent']> & { [composed]?: true };

/** Compose the application's keyboard decision with the kit's native control behavior. */
export function withCellKeyboard<R, V = unknown>(definition: ColDef<R, V>): ColDef<R, V> {
  const original: KeyboardRule<R> | undefined = definition.suppressKeyboardEvent;
  if (original === suppressCellControlKeyboard || original?.[composed]) return definition;
  if (!original) return { ...definition, suppressKeyboardEvent: suppressCellControlKeyboard };
  const rule = Object.assign(
    (params: SuppressKeyboardEventParams<R>) => {
      const application = original(params);
      return suppressCellControlKeyboard(params) || application;
    },
    { [composed]: true as const },
  );
  return { ...definition, suppressKeyboardEvent: rule };
}

/** Configure leaf columns, preserving explicit overrides and inherited default callbacks. */
export function withCellKeyboardColumns<R>(
  definitions: (ColDef<R> | ColGroupDef<R>)[],
  defaults: ColDef<R> = {},
): (ColDef<R> | ColGroupDef<R>)[] {
  let changed = false;
  const columns = definitions.map((definition) => {
    if ('children' in definition) {
      const children = withCellKeyboardColumns(definition.children, defaults);
      if (children === definition.children) return definition;
      changed = true;
      return { ...definition, children };
    }
    const inherited = definition.suppressKeyboardEvent ?? defaults.suppressKeyboardEvent;
    const next = withCellKeyboard(
      inherited === definition.suppressKeyboardEvent
        ? definition
        : { ...definition, suppressKeyboardEvent: inherited },
    );
    changed ||= next !== definition;
    return next;
  });
  return changed ? columns : definitions;
}
