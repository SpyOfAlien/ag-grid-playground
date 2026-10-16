import type { ActionPart } from '../../capabilities/action/action.model';
import type { ContentPart } from '../../capabilities/content/content.model';
import type { MarkerPart } from '../../capabilities/marker/marker.model';
import type { DropdownConfig } from '../../capabilities/dropdown/dropdown.model';

export type DropdownCellParams<R, V> = ContentPart<R, V> &
  MarkerPart<R, V> &
  ActionPart<R, V> & {
    dropdown: DropdownConfig<R, V>;
  };
