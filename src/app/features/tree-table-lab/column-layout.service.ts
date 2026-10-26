import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { LAYOUT_API, USER_HEADER } from './layout-api/column-layout-api.interceptor';
import { LabUser } from './lab-user';
import type { SavedColumn, TableType } from './tree-table.model';

const SAVE_DELAY = 500;

/** Saved column layouts of the current user, cached after one load per table. */
@Injectable({ providedIn: 'root' })
export class ColumnLayoutService {
  private readonly http = inject(HttpClient);
  private readonly user = inject(LabUser);
  /** `user|layoutKey` → columns. */
  private readonly cache = new Map<string, readonly SavedColumn[]>();
  /** One pending save per user and key, so a view switch never drops another view's change. */
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();

  loadAll(table: TableType): Observable<void> {
    const user = this.user.id();
    return this.http
      .get<Record<string, SavedColumn[]>>(`${LAYOUT_API}/${table}`, { headers: headers(user) })
      .pipe(
        map((layouts) => {
          for (const [key, layout] of Object.entries(layouts))
            // A change still waiting to be sent is newer than the server's copy.
            if (!this.pending.has(id(user, key))) this.cache.set(id(user, key), layout);
        }),
      );
  }

  get(key: string): readonly SavedColumn[] | undefined {
    return this.cache.get(id(this.user.id(), key));
  }

  /** Sends at once; used for the first layout of a view. */
  save(key: string, layout: readonly SavedColumn[]): void {
    const user = this.user.id();
    this.cancelPending(user, key);
    this.cache.set(id(user, key), layout);
    this.put(user, key, layout);
  }

  /** Caches now and sends after the user stops changing columns for a moment. */
  queueSave(key: string, layout: readonly SavedColumn[]): void {
    const user = this.user.id();
    this.cancelPending(user, key);
    this.cache.set(id(user, key), layout);
    this.pending.set(
      id(user, key),
      setTimeout(() => {
        this.pending.delete(id(user, key));
        this.put(user, key, layout);
      }, SAVE_DELAY),
    );
  }

  reset(key: string): Observable<unknown> {
    const user = this.user.id();
    this.cancelPending(user, key);
    this.cache.delete(id(user, key));
    return this.http.delete(`${LAYOUT_API}/${encodeURIComponent(key)}`, {
      headers: headers(user),
    });
  }

  private put(user: string, key: string, layout: readonly SavedColumn[]): void {
    this.http
      .put(`${LAYOUT_API}/${encodeURIComponent(key)}`, layout, { headers: headers(user) })
      .subscribe();
  }

  private cancelPending(user: string, key: string): void {
    clearTimeout(this.pending.get(id(user, key)));
    this.pending.delete(id(user, key));
  }
}

const id = (user: string, key: string) => `${user}|${key}`;
const headers = (user: string) => new HttpHeaders({ [USER_HEADER]: user });
