import type { ColDef, ColGroupDef, SuppressKeyboardEventParams } from 'ag-grid-community';
import { suppressCellControlKeyboard } from '../core/suppress-cell-control-keyboard';

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
