import { computed, Injectable, signal, type Signal } from '@angular/core';
import { toCellContext, type CellFacts } from '../core/cell-context';
import type { GridContext } from '../core/grid-context';
import type { CellIdentity } from '../editing/edit-command.model';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export interface SaveState {
  readonly pending: boolean;
  readonly error: string;
}

export type SaveOutcome = 'saved' | 'failed' | 'busy';

export const IDLE_SAVE: SaveState = { pending: false, error: '' };

const FAILURE_LIMIT = 256;

function cellKey(cell: CellIdentity): string {
  return JSON.stringify([cell.rowId, cell.columnId]);
}

/**
 * Feature-level save state for direct cell controls. Grid renderers are recycled while a save
 * runs; keeping the state here lets a recreated renderer see the pending save and its failure.
 * Provide at the owning component and pass it as `cellOperations` in the grid context.
 */
@Injectable()
export class CellOperations {
  private readonly states = signal<ReadonlyMap<string, SaveState>>(new Map());

  state(cell: CellIdentity): SaveState {
    return this.states().get(cellKey(cell)) ?? IDLE_SAVE;
  }

  async run(cell: CellIdentity, task: () => Promise<void>): Promise<SaveOutcome> {
    const key = cellKey(cell);
    if (this.states().get(key)?.pending) return 'busy';
    this.write(key, { pending: true, error: '' });
    try {
      await task();
      this.write(key, null);
      return 'saved';
    } catch (error: unknown) {
      this.write(key, { pending: false, error: errorMessage(error) });
      return 'failed';
    }
  }

  private write(key: string, state: SaveState | null): void {
    this.states.update((current) => {
      const next = new Map(current);
      next.delete(key);
      if (state) next.set(key, state);
      // Retain the most recent failures only; pending saves are never evicted.
      for (const [entry, value] of next) {
        if (next.size <= FAILURE_LIMIT) break;
        if (!value.pending) next.delete(entry);
      }
      return next;
    });
  }
}

export interface SaveTarget {
  readonly operations: CellOperations | undefined;
  readonly cell: CellIdentity | null;
}

export interface SaveTracker {
  readonly state: Signal<SaveState>;
  run(task: () => Promise<void>): Promise<SaveOutcome>;
}

/**
 * Tracks one save at a time. With a target that has shared `CellOperations` and a cell identity,
 * state is shared through the feature; otherwise it is local to the caller.
 */
export function trackSave(target?: () => SaveTarget | null): SaveTracker {
  const local = signal<SaveState>(IDLE_SAVE);
  const shared = () => {
    const resolved = target?.();
    return resolved?.operations && resolved.cell
      ? { operations: resolved.operations, cell: resolved.cell }
      : null;
  };
  return {
    state: computed(() => {
      const resolved = shared();
      return resolved ? resolved.operations.state(resolved.cell) : local();
    }),
    async run(task) {
      const resolved = shared();
      if (resolved) return resolved.operations.run(resolved.cell, task);
      if (local().pending) return 'busy';
      local.set({ pending: true, error: '' });
      try {
        await task();
        local.set(IDLE_SAVE);
        return 'saved';
      } catch (error: unknown) {
        local.set({ pending: false, error: errorMessage(error) });
        return 'failed';
      }
    },
  };
}

/** The shared save target for a rendered cell, when the grid context provides `CellOperations`. */
export function cellSaveTarget<R, V>(
  params: (CellFacts<R, V> & { readonly context?: GridContext }) | null,
): SaveTarget | null {
  if (!params) return null;
  const cell = toCellContext(params);
  if (!cell.rowId) return null;
  return {
    operations: params.context?.cellOperations,
    cell: { rowId: cell.rowId, columnId: cell.columnId },
  };
}
