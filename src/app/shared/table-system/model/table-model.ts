import { RevisionConflictError } from './errors';
import { computed, signal } from '@angular/core';
export interface RowIdentity {
  readonly id: string;
  readonly revision: number;
}
export interface CellAddress {
  readonly rowId: string;
  readonly columnId: string;
}
export interface EditTarget {
  readonly entityId: string;
  readonly operation: string;
}
export interface DatasetIdentity {
  readonly id: string;
  readonly generation: number;
}
export type TableUpdate<R extends RowIdentity> =
  | {
      readonly kind: 'patch';
      readonly rows: readonly {
        readonly id: string;
        readonly changes: Partial<Omit<R, 'id'>>;
        readonly expectedRevision?: number;
      }[];
    }
  | { readonly kind: 'replace'; readonly rows: readonly R[] };
export class TableModel<R extends RowIdentity> {
  private readonly rowState = signal<readonly R[]>([]);
  private readonly datasetState = signal<DatasetIdentity>({ id: '', generation: 0 });
  readonly rows = this.rowState.asReadonly();
  readonly dataset = this.datasetState.asReadonly();
  constructor(
    id: string,
    rows: readonly R[],
    private readonly validate: (row: R) => void,
  ) {
    this.reset(id, rows);
  }
  private readonly indexedRows = computed(() => computeRowIndex(this.rows()));
  lookup(id: string): R | undefined {
    return this.indexedRows().get(id);
  }
  reset(id: string, rows: readonly R[]): void {
    if (!id) throw new Error('Dataset identity is required');
    const next = this.checked(rows);
    this.datasetState.set({ id, generation: this.dataset().generation + 1 });
    this.rowState.set(next);
  }
  commit(update: TableUpdate<R>): void {
    if (update.kind === 'replace') {
      this.rowState.set(this.checked(update.rows));
      return;
    }
    const patches = new Map(update.rows.map((patch) => [patch.id, patch]));
    if (patches.size !== update.rows.length) throw new Error('Duplicate patch identity');
    for (const patch of patches.values()) {
      const row = this.lookup(patch.id);
      if (!row) throw new Error('Row no longer exists');
      if (patch.expectedRevision !== undefined && row.revision !== patch.expectedRevision)
        throw new RevisionConflictError();
    }
    const next = this.rows().map((row) => {
      const patch = patches.get(row.id);
      return patch ? { ...row, ...patch.changes, id: row.id } : row;
    });
    this.rowState.set(this.checked(next));
  }
  private checked(rows: readonly R[]): readonly R[] {
    const seen = new Set<string>();
    return Object.freeze(
      rows.map((row) => {
        if (!row.id || seen.has(row.id)) throw new Error('Invalid or duplicate row identity');
        seen.add(row.id);
        this.validate(row);
        return Object.isFrozen(row) ? row : Object.freeze({ ...row });
      }),
    );
  }
}

function computeRowIndex<R extends RowIdentity>(rows: readonly R[]): ReadonlyMap<string, R> {
  return new Map(rows.map((row) => [row.id, row]));
}
