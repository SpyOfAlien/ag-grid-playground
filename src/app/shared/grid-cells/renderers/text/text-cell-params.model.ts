import type { ContentPart } from '../../capabilities/content/content.model';
import type { MarkerPart } from '../../capabilities/marker/marker.model';

export type TextCellParams<R> = ContentPart<R, string> & MarkerPart<R, string>;
