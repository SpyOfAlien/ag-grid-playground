import type { ActionPart } from '../../capabilities/action/action.model';
import type { ContentPart } from '../../capabilities/content/content.model';
import type { MarkerPart } from '../../capabilities/marker/marker.model';
import type { TogglePart } from '../../capabilities/toggle/toggle.model';

export type ToggleCellParams<R> = ContentPart<R, boolean> &
  MarkerPart<R, boolean> &
  ActionPart<R, boolean> &
  TogglePart<R>;
