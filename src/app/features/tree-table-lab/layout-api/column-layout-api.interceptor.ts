import { inject } from '@angular/core';
import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { mergeMap, of, throwError, timer } from 'rxjs';
import type { SavedColumn } from '../tree-table.model';
import { ColumnLayoutStore } from './column-layout-store';

export const LAYOUT_API = '/api/column-layouts';
/**
 * The user the SSO session belongs to. A real server reads it from the session cookie or token;
 * the client never sends it.
 */
export const SESSION_USER = 'anna';
const LATENCY = 150;

/**
 * Answers the column-layout endpoints from the in-memory store, like a server would:
 *   GET    /api/column-layouts/:table → { [layoutKey]: SavedColumn[] } for the session's user
 *   PUT    /api/column-layouts/:key   ← SavedColumn[]
 *   DELETE /api/column-layouts/:key
 * Every other request goes to the real HTTP chain.
 */
export const columnLayoutApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith(`${LAYOUT_API}/`)) return next(request);

  const store = inject(ColumnLayoutStore);
  const id = decodeURIComponent(request.url.slice(LAYOUT_API.length + 1));
  store.record(request.method, request.url, SESSION_USER);

  const respond = (body: unknown) =>
    timer(LATENCY).pipe(mergeMap(() => of(new HttpResponse({ status: 200, body }))));
  const fail = (status: number, message: string) =>
    timer(LATENCY).pipe(
      mergeMap(() => throwError(() => new HttpErrorResponse({ status, error: { message } }))),
    );

  switch (request.method) {
    case 'GET':
      return store.failLoads()
        ? fail(503, 'Layouts are unavailable.')
        : respond(store.layoutsFor(SESSION_USER, id));
    case 'PUT':
      return timer(LATENCY).pipe(
        mergeMap(() => {
          store.put(SESSION_USER, id, request.body as SavedColumn[]);
          return of(new HttpResponse({ status: 204 }));
        }),
      );
    case 'DELETE':
      return timer(LATENCY).pipe(
        mergeMap(() => {
          store.remove(SESSION_USER, id);
          return of(new HttpResponse({ status: 204 }));
        }),
      );
    default:
      return fail(405, `${request.method} is not supported.`);
  }
};
