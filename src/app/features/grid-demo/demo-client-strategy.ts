import { InjectionToken } from '@angular/core';
import type { DemoClientStrategy } from './demo-grid-updates';
export const DEMO_CLIENT_STRATEGY = new InjectionToken<DemoClientStrategy>(
  'Demo client update strategy',
);
