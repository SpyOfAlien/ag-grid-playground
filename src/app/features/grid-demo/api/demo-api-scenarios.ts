import { HttpContextToken } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import type { DemoRow } from '../demo-row.model';

export const DEMO_DATASET = new HttpContextToken<readonly DemoRow[]>(() => []);

@Injectable({ providedIn: 'root' })
export class DemoApiScenarios {
  readonly outcome = signal<'success' | 'failure'>('success');
  readonly latency = signal(500);
  readonly calls = signal(0);
}
