import type { ColDef } from 'ag-grid-community';

export interface ColumnGroupRow {
  readonly id: string;
  readonly name: string;
  readonly revenue: number;
  readonly cost: number;
  readonly quantity: number;
  readonly region: string;
  readonly team: string;
  readonly status: string;
  readonly unit: string;
  readonly notes: string;
}

export const COLUMN_GROUP_COLUMNS: ColDef<ColumnGroupRow>[] = [
  { field: 'id', headerName: 'Row ID', width: 130 },
  { field: 'name', headerName: 'Name', width: 190 },
  { field: 'revenue', headerName: 'Revenue', width: 160 },
  { field: 'cost', headerName: 'Cost', width: 160 },
  { field: 'quantity', headerName: 'Quantity', width: 160 },
  { field: 'region', headerName: 'Region', width: 160 },
  { field: 'team', headerName: 'Team', width: 160 },
  { field: 'status', headerName: 'Status', width: 160 },
  { field: 'unit', headerName: 'Unit', width: 160 },
  { field: 'notes', headerName: 'Notes', width: 240 },
];

export const COLUMN_GROUP_ROWS: ColumnGroupRow[] = Array.from({ length: 12 }, (_, index) => ({
  id: `sample-${String(index + 1).padStart(2, '0')}`,
  name: `Product ${index + 1}`,
  revenue: 1200 + index * 250,
  cost: 650 + index * 100,
  quantity: 20 + index * 5,
  region: ['North', 'South', 'East', 'West'][index % 4],
  team: ['Sales', 'Operations', 'Support'][index % 3],
  status: index % 3 === 0 ? 'Pending' : 'Approved',
  unit: 'kg',
  notes: index % 2 === 0 ? 'Priority order' : 'Standard order',
}));
