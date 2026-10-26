import { Injectable, signal } from '@angular/core';
import type { SavedColumn } from '../tree-table.model';

/** The fake backend's database: user → layout key → columns. */
export type LayoutDb = Readonly<Record<string, Readonly<Record<string, readonly SavedColumn[]>>>>;

export interface ApiCall {
  readonly id: number;
  readonly method: string;
  readonly url: string;
  readonly user: string;
}

/**
 * Stands in for the server's storage: a plain JSON object in memory. Nothing is kept across a
 * page reload.
 */
@Injectable({ providedIn: 'root' })
export class ColumnLayoutStore {
  private readonly db = signal<LayoutDb>({});
  private readonly log = signal<readonly ApiCall[]>([]);
  private nextCall = 1;

  readonly data = this.db.asReadonly();
  readonly calls = this.log.asReadonly();

  /** Every layout of one user whose key starts with `table:`. */
  layoutsFor(user: string, table: string): Record<string, readonly SavedColumn[]> {
    return Object.fromEntries(
      Object.entries(this.db()[user] ?? {}).filter(([key]) => key.startsWith(`${table}:`)),
    );
  }

  put(user: string, key: string, layout: readonly SavedColumn[]): void {
    this.db.update((db) => ({ ...db, [user]: { ...db[user], [key]: layout } }));
  }

  remove(user: string, key: string): void {
    this.db.update((db) => {
      const { [key]: _removed, ...rest } = db[user] ?? {};
      return { ...db, [user]: rest };
    });
  }

  record(method: string, url: string, user: string): void {
    const call = { id: this.nextCall++, method, url, user };
    this.log.update((calls) => [call, ...calls].slice(0, 30));
  }
}
