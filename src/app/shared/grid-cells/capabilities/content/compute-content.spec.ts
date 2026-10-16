import { computeContent } from './compute-content';
import type { CellFacts } from '../../core/cell-context';
import type { ContentPart } from './content.model';
const base: CellFacts<{ reviewed: boolean }, number> = {
  data: { reviewed: true },
  node: { id: 'r1' },
  value: 0,
};
describe('Content computation', () => {
  it('returns null before initialization', () => expect(computeContent(null)).toBeNull());
  it('resolves all defaults even for an empty or group cell', () => {
    expect(computeContent({ ...base, data: undefined, value: undefined })).toEqual({
      alignment: 'start',
      highlighted: false,
      disabled: false,
      ellipsis: true,
      tooltip: null,
    });
  });
  it('evaluates each configured category and preserves explicit false', () => {
    const params: typeof base & ContentPart<{ reviewed: boolean }, number> = {
      ...base,
      content: {
        alignment: 'end',
        highlighted: ({ data }) => data?.reviewed ?? false,
        disabled: true,
        ellipsis: false,
        tooltip: ({ value }) => String(value),
      },
    };
    expect(computeContent(params)).toEqual({
      alignment: 'end',
      highlighted: true,
      disabled: true,
      ellipsis: false,
      tooltip: '0',
    });
    expect(params.value).toBe(0);
  });
});
