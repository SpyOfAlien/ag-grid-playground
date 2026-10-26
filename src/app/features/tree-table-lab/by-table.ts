import type { TableType } from './tree-table.model';

/** A value per table; `default` is used by every table without its own. */
export type PerTable<T> = Partial<Record<TableType, T>> & { readonly default?: T };

/**
 * Picks a table's own value (a getter, a rule, a header…), else `default`.
 *
 *   byTable(table, { default: 'Quantity', outbound: 'Shipped qty' })   most share, one differs
 *   byTable(table, { bom: a, inbound: b, outbound: c })               each its own
 *   byTable(table, { outbound: [notFullyShipped] })                   only outbound; others none
 *
 * With every table listed or a `default`, there is always a value. Otherwise the tables left out
 * get undefined, which a marker list reads as "no marker of this kind".
 *
 * The cells kit owns the grid's `context` (it holds the edit session), so a table cannot be read
 * from it at run time. Each table builds its columns once instead, and picks here at build time.
 */
export function byTable<T>(
  table: TableType,
  values: Record<TableType, T> | (PerTable<T> & { readonly default: T }),
): T;
export function byTable<T>(table: TableType, values: PerTable<T>): T | undefined;
export function byTable<T>(table: TableType, values: PerTable<T>): T | undefined {
  return values[table] ?? values.default;
}
