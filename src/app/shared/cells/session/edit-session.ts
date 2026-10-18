import { computed, DestroyRef, inject, signal } from '@angular/core';
import type { Command, EditPersistence, Result } from './persistence';
import { rowChanges, type RowChanges } from './row-changes';

export type EntryStatus = 'pending' | 'saved' | 'failed';

export interface Entry<Row, P> {
  readonly id: number;
  /** The entry immediately before this one, whatever its status. */
  readonly previousId: number | null;
  readonly command: Command<P>;
  readonly status: EntryStatus;
  /** What this entry changed compared with the previous successful table; set only on success. */
  readonly changes?: RowChanges<Row>;
  readonly error?: string;
}

/** One table on screen connected to the session; each grid built with `cellGridOptions` is one. */
export interface ConnectedGrid<Row> {
  /** Shows the whole table, for example when the grid connects. */
  show(rows: readonly Row[]): void;
  /** Applies a successful result; `changes` is what it changed in the previous successful table. */
  apply(result: Result<Row>, changes: RowChanges<Row>): void;
}

export class EditSession<Row, P extends EditPersistence<Row>> {
  private readonly log = signal<readonly Entry<Row, P>[]>([]);
  private readonly locked = signal<string | null>(null);
  private readonly table = signal<readonly Row[]>([]);
  private nextId = 1;
  private destroyed = false;
  private readonly grids = new Set<ConnectedGrid<Row>>();

  readonly entries = this.log.asReadonly();
  readonly current = computed(() => latestSaved(this.entries()));
  /** The table of the latest successful entry. */
  readonly rows = this.table.asReadonly();
  /** Why the page locked the grid, or null. */
  readonly lockReason = this.locked.asReadonly();
  /** A command is running; no other can start until it settles. */
  readonly busy = computed(() => this.entries().at(-1)?.status === 'pending');
  /** Why nothing in the grid can be edited right now, or null: the lock first, then "Saving…". */
  readonly disabledReason = computed(() => this.lockReason() ?? (this.busy() ? 'Saving…' : null));

  constructor(
    private readonly persistence: P,
    readonly rowId: (row: Row) => string,
    owner: DestroyRef,
  ) {
    owner.onDestroy(() => (this.destroyed = true));
  }

  async run(command: Command<P>): Promise<void> {
    if (this.destroyed) throw new Error('The grid is gone.');
    const reason = this.disabledReason();
    if (reason) throw new Error(reason);
    const id = this.nextId++;
    this.log.update((log) => [
      ...log,
      { id, previousId: log.at(-1)?.id ?? null, command, status: 'pending' },
    ]);
    // The persistence gets only the payload; `source` stays on the entry.
    const { method: name, payload } = command as { method: keyof P; payload?: unknown };
    const method = this.persistence[name] as (payload: unknown) => Promise<Result<Row>>;
    try {
      const result = await method.call(this.persistence, payload);
      if (this.destroyed) throw new Error('The grid is gone.');
      const previous = this.rows();
      const rows = 'replace' in result ? result.replace : this.merge(result.update);
      const changes = rowChanges(previous, rows, this.rowId);
      this.table.set(rows);
      this.settle(id, { status: 'saved', changes });
      for (const grid of this.grids) grid.apply(result, changes);
    } catch (error: unknown) {
      this.settle(id, { status: 'failed', error: errorMessage(error) });
      throw error;
    }
  }

  /** Shows the current rows in a grid and keeps it in step; returns the disconnect. */
  connect(grid: ConnectedGrid<Row>): () => void {
    this.grids.add(grid);
    grid.show(this.rows());
    return () => this.grids.delete(grid);
  }

  lock(reason: string): void {
    this.locked.set(reason);
  }

  unlock(): void {
    this.locked.set(null);
  }

  private settle(id: number, outcome: Pick<Entry<Row, P>, 'status' | 'changes' | 'error'>): void {
    this.log.update((log) =>
      log.map((entry) => (entry.id === id ? { ...entry, ...outcome } : entry)),
    );
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
