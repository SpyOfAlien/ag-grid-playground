// Marker rules every cluster uses. The kit takes markers as lists of rules per kind.
import type { Cell, Markers } from '@cells';
import type { RowData, RowRecord } from '../../tree-table.model';
import type { EditableField } from './columns';

/**
 * Edited by a user: the field differs from the row as it was created. Editing it back to the
 * original clears the marker. The tooltip shows the original value.
 */
export const edited =
  <V>(field: EditableField) =>
  ({ row }: Cell<RowData, V>): string | false =>
    !Object.is(row[field], row.original[field]) &&
    `Edited by a user (was ${shown(row.original[field])})`;

/** Adds the "edited by a user" rule for a field to a column's own markers. */
export const withEdited = <V>(
  field: EditableField,
  markers: Markers<RowData, V> = {},
): Markers<RowData, V> => ({
  ...markers,
  userEdited: [edited(field), ...(markers.userEdited ?? [])],
});

/** An original value as the tooltip says it: short, and clear when it was empty or a switch. */
function shown(value: RowRecord[EditableField]): string {
  if (typeof value === 'boolean') return value ? 'on' : 'off';
  if (typeof value === 'number') return value.toLocaleString('en-US');
  const text = value.split('\n')[0];
  if (!text) return 'empty';
  return `“${text.length > 40 ? `${text.slice(0, 39)}…` : text}”`;
}
