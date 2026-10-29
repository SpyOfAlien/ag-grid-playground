import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { demoApiInterceptor } from './features/grid-demo/api/demo-api-interceptor';
import { columnLayoutApiInterceptor } from './features/tree-table-lab/layout-api/column-layout-api.interceptor';

import { providePrimeNG } from 'primeng/config';
import { routes } from './app.routes';
import { SignalPreset } from './primeng-preset';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Fetch, so a request can be sent with keepalive as the page closes.
    provideHttpClient(
      withFetch(),
      withInterceptors([demoApiInterceptor, columnLayoutApiInterceptor]),
    ),
    // Light only: the dark variant is keyed to a class nothing sets, not the OS setting.
    providePrimeNG({ theme: { preset: SignalPreset, options: { darkModeSelector: '.app-dark' } } }),
  ],
};
