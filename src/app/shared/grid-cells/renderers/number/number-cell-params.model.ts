import type { ContentPart } from '../../capabilities/content/content.model';
import type { MarkerPart } from '../../capabilities/marker/marker.model';

export type NumberCellParams<R> = ContentPart<R, number> & MarkerPart<R, number>;
