import { inject } from '@angular/core';
import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { mergeMap, of, throwError, timer } from 'rxjs';
import type { SavedColumn } from '../tree-table.model';
import { ColumnLayoutStore } from './column-layout-store';

export const LAYOUT_API = '/api/column-layouts';
export const USER_HEADER = 'X-Lab-User';
const LATENCY = 150;

/**
 * Answers the column-layout endpoints from the in-memory store, like a server would:
 *   GET    /api/column-layouts/:table → { [layoutKey]: SavedColumn[] } for the user
 *   PUT    /api/column-layouts/:key   ← SavedColumn[]
 *   DELETE /api/column-layouts/:key
 * Every other request goes to the real HTTP chain.
 */
export const columnLayoutApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(`${LAYOUT_API}/`)) return next(request);

  const store = inject(ColumnLayoutStore);
  const user = request.headers.get(USER_HEADER);
  const id = decodeURIComponent(request.url.slice(LAYOUT_API.length + 1));
  store.record(request.method, request.url, user ?? '(none)');

  const respond = (body: unknown) =>
    timer(LATENCY).pipe(mergeMap(() => of(new HttpResponse({ status: 200, body }))));
  const fail = (status: number, message: string) =>
    timer(LATENCY).pipe(
      mergeMap(() => throwError(() => new HttpErrorResponse({ status, error: { message } }))),
    );

  if (!user) return fail(401, 'No user.');
  switch (request.method) {
    case 'GET':
      return respond(store.layoutsFor(user, id));
    case 'PUT':
      return timer(LATENCY).pipe(
        mergeMap(() => {
          store.put(user, id, request.body as SavedColumn[]);
          return of(new HttpResponse({ status: 204 }));
        }),
      );
    case 'DELETE':
      return timer(LATENCY).pipe(
        mergeMap(() => {
          store.remove(user, id);
          return of(new HttpResponse({ status: 204 }));
        }),
      );
    default:
      return fail(405, `${request.method} is not supported.`);
  }
};
