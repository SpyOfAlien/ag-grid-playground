// Test-only helpers: renderer params backed by a real EditSession and an in-memory persistence.
import { TestBed } from '@angular/core/testing';
import type { ICellRendererParams } from 'ag-grid-community';
import { cellSession, type CellsContext } from '../grid/cell-grid-options';
import { createEditSession, type EditSession } from '../session/edit-session';
import type { Command, EditPersistence, Result, SaveCommand } from '../session/persistence';

export interface Item {
  readonly sku: string;
  readonly name: string;
  readonly qty: number | null;
  readonly active: boolean;
  readonly category: string | null;
  readonly locked: boolean;
}

export const ITEM: Item = {
  sku: 'A-1',
  name: 'Bolt',
  qty: 1250.5,
  active: true,
  category: 'hw',
  locked: false,
};

export class FakePersistence implements EditPersistence<Item> {
  readonly saved: SaveCommand<Item>[] = [];
  next: () => Promise<Result<Item>> = () => Promise.resolve({ update: [] });

  load(_command?: Command): Promise<Result<Item>> {
    return Promise.resolve({ replace: [ITEM] });
  }

  save(command: SaveCommand<Item>): Promise<Result<Item>> {
    this.saved.push(command);
    return this.next();
  }

  readonly approved: (Command & { readonly skus: readonly string[] })[] = [];

  approve(command: Command & { readonly skus: readonly string[] }): Promise<Result<Item>> {
    this.approved.push(command);
    return this.next();
  }
}

export function testSession(persistence: FakePersistence = new FakePersistence()) {
  return TestBed.runInInjectionContext(() =>
    createEditSession(persistence, (item: Item) => item.sku),
  );
}

export function rendererParams<V, C extends object>(
  session: EditSession<Item, FakePersistence>,
  config: C,
  value: V | null | undefined,
  options: { row?: Item; columnId?: string; field?: keyof Item; headerName?: string } = {},
): ICellRendererParams<Item, V, CellsContext> & C {
  const row = options.row ?? ITEM;
  const columnId = options.columnId ?? 'col';
  return {
    ...config,
    value,
    valueFormatted: null,
    data: row,
    node: { id: row.sku },
    column: { getColId: () => columnId },
    colDef: { colId: columnId, field: options.field, headerName: options.headerName ?? 'Column' },
    context: { session: cellSession(session) },
  } as unknown as ICellRendererParams<Item, V, CellsContext> & C;
}

/** Lets pending promises (saves) settle, then waits for Angular to render. */
export async function settle(fixture: { whenStable(): Promise<unknown> }): Promise<void> {
  await new Promise((done) => setTimeout(done));
  await fixture.whenStable();
}
