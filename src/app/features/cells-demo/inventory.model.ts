export type Category = 'hardware' | 'tools' | 'fasteners';
export type Supplier = 'acme' | 'bolt' | 'fixit' | 'legacy';

/** The demo's fixed "today", so dates never depend on the clock. */
export const DEMO_TODAY = '2026-10-01';

export interface Item {
  readonly sku: string;
  readonly name: string;
  readonly category: Category | null;
  readonly qty: number | null;
  readonly unitPrice: number;
  /** Derived: qty × unitPrice, recalculated by persistence. */
  readonly stockValue: number;
  readonly active: boolean;
  readonly discontinued: boolean;
  readonly reorder: boolean;
  readonly reorderLevel: number;
  readonly notes: string;
  readonly approved: boolean;
  readonly supplier: Supplier | null;
  readonly location: string;
  /** ISO date (yyyy-mm-dd) of the last stock count. */
  readonly lastCounted: string;
}

const NAMES = [
  'Hex bolt',
  'Wood screw',
  'Wall plug',
  'Claw hammer',
  'Spirit level',
  'Wing nut',
  'Cable tie',
  'Hinge',
  'Masonry drill',
  'Tape measure',
  'Washer',
  'Pipe clamp',
];
const SUPPLIERS: Supplier[] = ['acme', 'bolt', 'fixit', 'acme', 'legacy', 'bolt'];
const LOCATIONS = ['Aisle A', 'Aisle B', 'Aisle C', 'Mezzanine', 'Yard 1', 'Yard 2'];
const ITEMS = 200;

/** The date `days` before the demo's today. */
function daysAgo(days: number): string {
  const date = new Date(`${DEMO_TODAY}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
const CATEGORIES: Category[] = [
  'fasteners',
  'fasteners',
  'hardware',
  'tools',
  'tools',
  'fasteners',
];

/**
 * 200 items. The first twelve keep fixed values the e2e tests rely on: SKU-03 has no quantity,
 * SKU-04 is discontinued, SKU-06 has no category and SKU-08 is approved.
 */
export function seedItems(): Item[] {
  return Array.from({ length: ITEMS }, (_, index) => {
    const later = index >= 12;
    const qty =
      index === 2 || (later && index % 23 === 0)
        ? null
        : later
          ? (index * 37) % 400
          : (index + 1) * 120;
    const unitPrice =
      Math.round((0.35 + (index % 12) * 1.7 + Math.floor(index / 12) * 0.05) * 100) / 100;
    return {
      sku: `SKU-${String(index + 1).padStart(2, '0')}`,
      name: `${NAMES[index % (later ? NAMES.length : 6)]} ${index + 1}`,
      category:
        index === 5 || (later && index % 17 === 0) ? null : CATEGORIES[index % CATEGORIES.length],
      qty,
      unitPrice,
      stockValue: (qty ?? 0) * unitPrice,
      active: index % 3 !== 1,
      discontinued: index === 3 || (later && index % 31 === 0),
      reorder: index % 2 === 0,
      reorderLevel: 50,
      notes: '',
      approved: index === 7 || (later && index % 19 === 0),
      supplier: index % 13 === 9 ? null : SUPPLIERS[index % SUPPLIERS.length],
      location: `${LOCATIONS[index % LOCATIONS.length]}-${String((index * 7) % 40).padStart(2, '0')}`,
      lastCounted: daysAgo((index * 11) % 140),
    };
  });
}
