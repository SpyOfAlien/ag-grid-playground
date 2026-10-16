import type {
  CellIdentity,
  HttpQueryParams,
} from '../../../shared/grid-cells/editing/edit-command.model';
import type { DemoDetailsEdit } from '../demo-persistence.model';
export interface DetailsEditorData {
  readonly cell: CellIdentity;
  readonly initialValue: DemoDetailsEdit;
  readonly queryParams?: HttpQueryParams;
}
