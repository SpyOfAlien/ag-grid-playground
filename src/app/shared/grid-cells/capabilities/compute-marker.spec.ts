import { computeMarker } from './marker';
import type { MarkerKind, MarkerPart } from './marker';
import type { CellFacts } from '../core/cell-context';
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
      const lower = priority.slice(priority.indexOf(kind) + 1);
      expect(computeMarker(params)).toEqual({
        kind,
        tooltip: kind,
        additional: lower.map((key) => ({ kind: key, tooltip: key })),
      });
      expect(Object.keys(markers)).toHaveLength(6);
    },
  );
  it('changes priority from metadata and reports lower active markers', () => {
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
    expect(computeMarker(params)).toEqual({
      kind: 'error',
      tooltip: 'error',
      additional: [{ kind: 'warning', tooltip: 'lower' }],
    });
    params.data.error = false;
    expect(computeMarker(params)).toEqual({ kind: 'warning', tooltip: 'lower', additional: [] });
    expect(lowerTooltip).toHaveBeenCalledTimes(2);
  });

  it('follows registered priority and keeps configured kinds without a definition', () => {
    const params = {
      data: {},
      value: 0,
      node: { id: 'r1' },
      markers: { error: { when: true }, info: { when: true }, special: { when: true } },
    };
    const definitions = [
      { kind: 'info', label: 'Info' },
      { kind: 'error', label: 'Error' },
    ] as const;
    expect(computeMarker(params, undefined, definitions)).toEqual({
      kind: 'info',
      tooltip: null,
      additional: [
        { kind: 'error', tooltip: null },
        { kind: 'special', tooltip: null },
      ],
    });
  });
});
