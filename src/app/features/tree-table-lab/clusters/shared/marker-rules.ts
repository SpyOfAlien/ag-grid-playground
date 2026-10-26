// Marker rules every cluster uses. The kit takes markers as lists of rules per kind.
import type { MarkerRule, Markers } from '@cells';
import type { RowData } from '../../tree-table.model';

/** Marks a field a user changed. */
export const edited =
  <V>(field: keyof RowData): MarkerRule<RowData, V> =>
  ({ row }) =>
    row.edited.includes(field) && 'Edited by a user';

/** Adds the "edited by a user" rule for a field to a column's own markers. */
export const withEdited = <V>(
  field: keyof RowData,
  markers: Markers<RowData, V> = {},
): Markers<RowData, V> => ({
  ...markers,
  userEdited: [edited(field), ...(markers.userEdited ?? [])],
});
