import type { GridContext } from '@grid-cells';
import type { DemoPersistenceMode } from './demo-row.model';
export interface DemoGridContext extends GridContext {
  readonly demoPersistenceMode: DemoPersistenceMode;
}
