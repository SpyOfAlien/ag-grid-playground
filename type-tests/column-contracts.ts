import { cellColumn, NumberCell, TextCell, provideGridCellMarkers } from '@grid-cells';
import type { MarkerPart } from '@grid-cells';

interface Row {
  id: string;
  name: string;
  amount: number | null;
}

declare module '@grid-cells' {
  interface MarkerKinds {
    stale: true;
  }
}

const column = cellColumn<Row>();

const amount = column(NumberCell<Row>, {
  field: 'amount',
  params: { content: { number: { decimals: 2 } } },
});
const derived = column(NumberCell<Row>, {
  colId: 'double',
  valueGetter: ({ data }) => (data?.amount ?? 0) * 2,
  params: {},
});
const name = column(TextCell<Row>, { field: 'name', params: {} });

column(NumberCell<Row>, {
  // @ts-expect-error A number renderer cannot display a string field.
  field: 'name',
  params: {},
});
column(TextCell<Row>, {
  // @ts-expect-error The value getter must produce the renderer's value type.
  valueGetter: () => 5,
  params: {},
});
column(NumberCell<Row>, {
  field: 'amount',
  // @ts-expect-error Params are checked against the renderer.
  params: { toggle: { save: async () => undefined } },
});

const stale: MarkerPart<Row, number> = { markers: { stale: { when: true } } };
const staleMarkers = provideGridCellMarkers([{ kind: 'stale', label: 'Stale value' }]);
const unknownMarker: MarkerPart<Row, number> = {
  // @ts-expect-error Unregistered marker kinds are rejected.
  markers: { unknown: { when: true } },
};

void [amount, derived, name, stale, staleMarkers, unknownMarker];
