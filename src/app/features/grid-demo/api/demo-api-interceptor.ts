import { inject } from '@angular/core';
import { HttpErrorResponse, HttpResponse, type HttpInterceptorFn } from '@angular/common/http';
import { of, throwError, timer, mergeMap } from 'rxjs';
import { DEMO_DATASET, DemoApiScenarios } from './demo-api-scenarios';
import { isDemoPayload, normalizeDemoResponse } from './demo-api.model';
// Demo endpoints are fulfilled locally. All other requests use the real HTTP chain.
export const demoApiInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/cell-kit-demo/')) return next(request);
  const scenarios = inject(DemoApiScenarios);
  scenarios.calls.update((count) => count + 1);
  const failure = scenarios.outcome() === 'failure';
  const delay = Math.max(0, Math.min(scenarios.latency(), 2000));
  const route = request.url.match(
    /^\/api\/cell-kit-demo\/rows\/([^/]+)\/(fields|details|approve)$/,
  );
  const payload: unknown = request.body;
  const approved = route?.[2] === 'approve';
  const valid =
    route &&
    request.method === (approved ? 'POST' : 'PATCH') &&
    isDemoPayload(payload) &&
    decodeURIComponent(route[1]) === payload.row.id;
  const response = valid
    ? normalizeDemoResponse(
        payload,
        approved,
        request.context.get(DEMO_DATASET).length
          ? request.context.get(DEMO_DATASET)
          : [payload.row],
      )
    : undefined;
  return timer(delay).pipe(
    mergeMap(() =>
      failure || !response
        ? throwError(
            () =>
              new HttpErrorResponse({
                status: failure ? 422 : 400,
                error: {
                  message: failure ? 'Demo server rejected this edit.' : 'Invalid demo request.',
                },
              }),
          )
        : of(new HttpResponse({ status: 200, body: response })),
    ),
  );
};
