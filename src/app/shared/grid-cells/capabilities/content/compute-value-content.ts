import type { CellFacts } from '../../core/cell-context';
import type { ContentPart, TextContentState } from './content.model';
import { computeNumberContent } from '../number/compute-number-content';
import { computeTextContent } from './compute-text-content';

export function computeValueContent<R, V>(
  params:
    | (CellFacts<R, V> &
        ContentPart<R, V> & {
          valueFormatted?: string | null;
        })
    | null,
): TextContentState | null {
  return params?.content?.number !== undefined
    ? computeNumberContent(params)
    : computeTextContent(params);
}
