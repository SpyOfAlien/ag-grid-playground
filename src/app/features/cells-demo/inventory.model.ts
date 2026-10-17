export type Category = 'hardware' | 'tools' | 'fasteners';

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
}

const NAMES = ['Hex bolt', 'Wood screw', 'Wall plug', 'Claw hammer', 'Spirit level', 'Wing nut'];
const CATEGORIES: Category[] = [
  'fasteners',
  'fasteners',
  'hardware',
  'tools',
  'tools',
  'fasteners',
];

/** Twelve items; SKU-03 has no quantity and SKU-04 is discontinued. */
export function seedItems(): Item[] {
  return Array.from({ length: 12 }, (_, index) => {
    const qty = index === 2 ? null : (index + 1) * 120;
    const unitPrice = Math.round((0.35 + index * 1.7) * 100) / 100;
    return {
      sku: `SKU-${String(index + 1).padStart(2, '0')}`,
      name: `${NAMES[index % NAMES.length]} ${index + 1}`,
      category: index === 5 ? null : CATEGORIES[index % CATEGORIES.length],
      qty,
      unitPrice,
      stockValue: (qty ?? 0) * unitPrice,
      active: index % 3 !== 1,
      discontinued: index === 3,
      reorder: index % 2 === 0,
      reorderLevel: 50,
      notes: '',
      approved: index === 7,
    };
  });
}
