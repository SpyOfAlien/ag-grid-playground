import { computeMarker } from './compute-marker';
import type { MarkerKind, MarkerPart } from './marker.model';
import type { CellFacts } from '../../core/cell-context';
const priority: MarkerKind[] = [
  'error',
  'warning',
  'userEdited',
  'systemGenerated',
  'info',
  'special',
];
describe('Marker computation', () => {
  it('omits absent, false, and uninitialized markers', () => {
    expect(computeMarker(null)).toBeNull();
    expect(computeMarker({ value: 1, node: {}, data: undefined })).toBeNull();
    expect(
      computeMarker({ value: 1, node: {}, data: undefined, markers: { error: { when: false } } }),
    ).toBeNull();
  });
  it.each(priority)(
    'chooses %s over all lower priority markers without deleting metadata',
    (kind) => {
      const markers = Object.fromEntries(
        priority.map((key) => [
          key,
          { when: priority.indexOf(key) >= priority.indexOf(kind), tooltip: key },
        ]),
      ) as NonNullable<MarkerPart<object, number>['markers']>;
      const params: CellFacts<object, number> & MarkerPart<object, number> = {
        data: {},
        value: 0,
        node: { id: 'r1' },
        markers,
      };
      expect(computeMarker(params)).toEqual({ kind, tooltip: kind });
      expect(Object.keys(markers)).toHaveLength(6);
    },
  );
  it('changes priority from metadata and evaluates only the selected tooltip', () => {
    const lowerTooltip = vi.fn(() => 'lower');
    const params = {
      data: { error: true },
      value: 0,
      node: { id: 'r1' },
      markers: {
        error: {
          when: ({ data }: { data: Readonly<{ error: boolean }> | undefined }) =>
            data?.error ?? false,
          tooltip: 'error',
        },
        warning: { when: true, tooltip: lowerTooltip },
      },
    };
    expect(computeMarker(params)?.kind).toBe('error');
    expect(lowerTooltip).not.toHaveBeenCalled();
    params.data.error = false;
    expect(computeMarker(params)).toEqual({ kind: 'warning', tooltip: 'lower' });
  });
});
