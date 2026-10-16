import type { GridContext } from '../../shared/grid-cells/core/grid-context.model';
import type { DemoPersistenceMode } from './demo-row.model';
export interface DemoGridContext extends GridContext {
  readonly demoPersistenceMode: DemoPersistenceMode;
}
