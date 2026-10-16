import type { CellIdentity, HttpQueryParams } from '@grid-cells';
import type { DemoDetailsEdit } from '../demo-persistence.model';
export interface DetailsEditorData {
  readonly cell: CellIdentity;
  readonly initialValue: DemoDetailsEdit;
  readonly queryParams?: HttpQueryParams;
}
