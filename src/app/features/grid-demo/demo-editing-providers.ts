import { DemoClientPersistence } from './demo-client-persistence';
import type { DemoClientStrategy } from './demo-grid-updates';

import { DEMO_CLIENT_STRATEGY } from './demo-client-strategy';
export { DEMO_CLIENT_STRATEGY } from './demo-client-strategy';

import type { Provider } from '@angular/core';
import { EditorHostService } from '../../shared/grid-cells/editing/editor-host/public-api';
import { DemoTableState } from './demo-table-state';
import { DEMO_TABLE_PERSISTENCE } from './demo-persistence.model';
import { DemoServerPersistence } from './demo-server-persistence';

/** Provide once on the table component; HttpClient configuration remains app-owned. */
export function provideDemoServerEditing(): Provider[] {
  return [
    EditorHostService,
    DemoTableState,
    DemoServerPersistence,
    { provide: DEMO_TABLE_PERSISTENCE, useExisting: DemoServerPersistence },
  ];
}

/** Connect the grid on gridReady; do not also bind canonical rows to rowData. */
export function provideDemoClientEditing(strategy: DemoClientStrategy = 'transaction'): Provider[] {
  return [
    EditorHostService,
    DemoTableState,
    DemoClientPersistence,
    { provide: DEMO_CLIENT_STRATEGY, useValue: strategy },
    { provide: DEMO_TABLE_PERSISTENCE, useExisting: DemoClientPersistence },
  ];
}

/** Demo runtime mode selection uses the two real implementations directly. */
export function provideDemoEditing(): Provider[] {
  return [...provideDemoClientEditing(), DemoServerPersistence];
}
