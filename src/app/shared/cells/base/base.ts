import { computed, Directive, isDevMode, signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { CellsContext } from '../grid/cells-context';

/** What every rule and formatter receives. */
export interface Cell<Row, V> {
  readonly rowId: string;
  readonly columnId: string;
  readonly row: Row;
  readonly value: V | null | undefined;
}

/** A fixed value, or one computed from the cell. */
export type CellRule<Row, V, T> = T | ((cell: Cell<Row, V>) => T);

export function evaluate<Row, V, T>(rule: CellRule<Row, V, T>, cell: Cell<Row, V>): T {
  return typeof rule === 'function' ? (rule as (cell: Cell<Row, V>) => T)(cell) : rule;
}

export type CellParams<Row, V, C> = ICellRendererParams<Row, V, CellsContext> & C;

/** Holds the latest AG Grid params and derives the cell from them. */
@Directive()
export abstract class CellBase<Row, V, C> implements ICellRendererAngularComp {
  private readonly source = signal<CellParams<Row, V, C> | null>(null);

  protected readonly params = this.source.asReadonly();
  protected readonly cell = computed((): Cell<Row, V> | null => {
    const params = this.source();
    if (!params?.data || !params.node.id) return null;
    return {
      rowId: params.node.id,
      columnId: params.column?.getColId() ?? '',
      row: params.data,
      value: params.value,
    };
  });

  agInit(params: CellParams<Row, V, C>): void {
    // Report the wiring mistake when the grid first renders, not on the first edit.
    if (isDevMode() && !params.context?.session)
      throw new Error('Cell renderers need a grid built with cellGridOptions().');
    this.source.set({ ...params });
  }

  refresh(params: CellParams<Row, V, C>): boolean {
    this.source.set({ ...params });
    return true;
  }
}
