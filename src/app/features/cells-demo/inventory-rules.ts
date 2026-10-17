import { applyChanges, type FieldChange } from '@cells';
import type { Item } from './inventory.model';

export const sku = (item: Item) => item.sku;

/** Business rules both persistences apply: changed rows plus their derived fields. */
export function applyInventoryChanges(
  rows: readonly Item[],
  changes: readonly FieldChange<Item>[],
): Item[] {
  return applyChanges(rows, sku, changes).map((item) => {
    if (
      item.approved &&
      changes.some((change) => change.rowId === item.sku && change.field !== 'notes')
    )
      throw new Error(`${item.sku} is approved and locked.`);
    if (item.qty !== null && (!Number.isFinite(item.qty) || item.qty < 0))
      throw new Error('Quantity must be zero or more.');
    return { ...item, stockValue: (item.qty ?? 0) * item.unitPrice };
  });
}

export function approveItems(rows: readonly Item[], skus: readonly string[]): Item[] {
  return rows.map((item) => (skus.includes(item.sku) ? { ...item, approved: true } : item));
}
