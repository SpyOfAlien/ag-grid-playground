import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, inject, Injectable } from '@angular/core';
import { catchError, map, of, type Observable } from 'rxjs';
import { LAYOUT_API } from './layout-api/column-layout-api.interceptor';
import type { SavedColumn, TableType } from './tree-table.model';

const SAVE_DELAY = 500;

/**
 * The signed-in user's saved column layouts, cached after one load per table. The server knows
 * the user from the SSO session, so no request names one.
 */
@Injectable({ providedIn: 'root' })
export class ColumnLayoutService {
  private readonly http = inject(HttpClient);
  /** Layout key → columns. */
  private readonly cache = new Map<string, readonly SavedColumn[]>();
  /** One pending save per key, so a view switch never drops another view's change. */
  private readonly pending = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly loaded = new Set<TableType>();

  constructor() {
    // A change still waiting to be sent goes out as the page closes.
    const page = inject(DOCUMENT).defaultView;
    const flush = () => this.flush();
    page?.addEventListener('pagehide', flush);
    inject(DestroyRef).onDestroy(() => page?.removeEventListener('pagehide', flush));
  }

  /**
   * Loads a table's layouts once. Emits whether they are cached; after a failed load the table
   * shows its defaults, and the next call tries again.
   */
  load(table: TableType): Observable<boolean> {
    if (this.loaded.has(table)) return of(true);
    return this.http.get<Record<string, SavedColumn[]>>(`${LAYOUT_API}/${table}`).pipe(
      map((layouts) => {
        for (const [key, layout] of Object.entries(layouts))
          // A change still waiting to be sent is newer than the server's copy.
          if (!this.pending.has(key)) this.cache.set(key, layout);
        this.loaded.add(table);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  get(key: string): readonly SavedColumn[] | undefined {
    return this.cache.get(key);
  }

  /** Caches now and sends after the user stops changing columns for a moment. */
  queueSave(key: string, layout: readonly SavedColumn[]): void {
    this.cancelPending(key);
    this.cache.set(key, layout);
    this.pending.set(
      key,
      setTimeout(() => {
        this.pending.delete(key);
        this.put(key, layout);
      }, SAVE_DELAY),
    );
  }

  reset(key: string): Observable<unknown> {
    this.cancelPending(key);
    this.cache.delete(key);
    return this.http.delete(`${LAYOUT_API}/${encodeURIComponent(key)}`);
  }

  /** Sends every pending save now; keepalive lets the request outlive the page. */
  private flush(): void {
    for (const key of [...this.pending.keys()]) {
      this.cancelPending(key);
      const layout = this.cache.get(key);
      if (layout) this.put(key, layout, true);
    }
  }

  private put(key: string, layout: readonly SavedColumn[], keepalive = false): void {
    this.http.put(`${LAYOUT_API}/${encodeURIComponent(key)}`, layout, { keepalive }).subscribe();
  }

  private cancelPending(key: string): void {
    clearTimeout(this.pending.get(key));
    this.pending.delete(key);
  }
}
