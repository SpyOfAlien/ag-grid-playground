import { computed, DestroyRef, inject, signal } from '@angular/core';
import type { GridApi } from 'ag-grid-community';
import type { CellRef, Command, CommandOf, EditPersistence, MethodOf, Result } from './persistence';

export type EntryStatus = 'pending' | 'saved' | 'failed';

export interface Entry<Row, P> {
  readonly id: number;
  /** The entry immediately before this one, whatever its status. */
  readonly previousId: number | null;
  readonly method: MethodOf<P>;
  readonly command: Command | undefined;
  readonly status: EntryStatus;
  /** The full table after this entry; set only on success. */
  readonly rows?: readonly Row[];
  readonly error?: string;
}

export class EditSession<Row, P extends EditPersistence<Row>> {
  private readonly log = signal<readonly Entry<Row, P>[]>([]);
  private readonly lockReason = signal<string | null>(null);
  private nextId = 1;
  private destroyed = false;
  private readonly grids = new Set<GridApi<Row>>();

  readonly entries = this.log.asReadonly();
  readonly current = computed(() => latestSaved(this.entries()));
  readonly rows = computed(() => this.current()?.rows ?? []);
  /** Why nothing in the grid can be edited right now, or null. */
  readonly disabledReason = computed(
    () => this.lockReason() ?? (this.entries().at(-1)?.status === 'pending' ? 'Saving…' : null),
  );

  constructor(
    private readonly persistence: P,
    readonly rowId: (row: Row) => string,
    owner: DestroyRef,
  ) {
    owner.onDestroy(() => (this.destroyed = true));
  }

  async run<M extends MethodOf<P>>(method: M, command: CommandOf<P, M>): Promise<void> {
    if (this.destroyed) throw new Error('The grid is gone.');
    const reason = this.disabledReason();
    if (reason) throw new Error(reason);
    const id = this.nextId++;
    this.log.update((log) => [
      ...log,
      { id, previousId: log.at(-1)?.id ?? null, method, command, status: 'pending' },
    ]);
    const call = this.persistence[method] as (command: CommandOf<P, M>) => Promise<Result<Row>>;
    try {
      const result = await call.call(this.persistence, command);
      if (this.destroyed) throw new Error('The grid is gone.');
      const rows = 'replace' in result ? result.replace : this.merge(result.update);
      this.settle(id, { status: 'saved', rows });
      this.show(result);
    } catch (error: unknown) {
      this.settle(id, { status: 'failed', error: errorMessage(error) });
      throw error;
    }
  }

  /** The error of the cell's latest settled command, if that command failed. Reactive. */
  errorFor(cell: CellRef): string | null {
    const log = this.entries();
    for (let index = log.length - 1; index >= 0; index--) {
      const entry = log[index];
      const source = entry.command?.source;
      if (entry.status === 'pending' || source?.rowId !== cell.rowId) continue;
      if (source.columnId === cell.columnId) return entry.error ?? null;
    }
    return null;
  }

  /** Shows the current rows in a grid and keeps it in step; returns the disconnect. */
  connect(api: GridApi<Row>): () => void {
    this.grids.add(api);
    api.setGridOption('rowData', [...this.rows()]);
    return () => this.grids.delete(api);
  }

  lock(reason: string): void {
    this.lockReason.set(reason);
  }

  unlock(): void {
    this.lockReason.set(null);
  }

  private settle(id: number, outcome: Pick<Entry<Row, P>, 'status' | 'rows' | 'error'>): void {
    this.log.update((log) =>
      log.map((entry) => (entry.id === id ? { ...entry, ...outcome } : entry)),
    );
  }

  private show(result: Result<Row>): void {
    for (const api of this.grids) {
      if ('replace' in result) {
        api.setGridOption('rowData', [...result.replace]);
        // Kept rows are updated in place by id, so they have the same refresh gap as transactions.
        api.refreshCells({ force: true });
      } else {
        const applied = api.applyTransaction({ update: [...result.update] });
        // A transaction only refreshes cells whose own value changed; rules may read other fields.
        api.refreshCells({ rowNodes: applied?.update, force: true });
      }
    }
  }

  /** Rows outside the current table are ignored; adding rows goes through `replace`. */
  private merge(update: readonly Row[]): readonly Row[] {
    const changed = new Map(update.map((row) => [this.rowId(row), row]));
    return this.rows().map((row) => changed.get(this.rowId(row)) ?? row);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function latestSaved<E extends { readonly status: EntryStatus }>(log: readonly E[]): E | null {
  for (let index = log.length - 1; index >= 0; index--)
    if (log[index].status === 'saved') return log[index];
  return null;
}

/** Call in the owning component's injection context; the session ends with that component. */
export function createEditSession<Row, P extends EditPersistence<Row>>(
  persistence: P,
  rowId: (row: Row) => string,
): EditSession<Row, P> {
  return new EditSession(persistence, rowId, inject(DestroyRef));
}
