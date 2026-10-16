export interface DemoRow {
  readonly id: string;
  readonly name: string;
  readonly notes?: string;
  readonly metrics: readonly (number | null)[];
  readonly metadata: {
    readonly reviewed: boolean;
    readonly revision: number;
    readonly unit: 'kg' | 't';
  };
}

// Demo setting only; the GridContext/edit contract belongs to step 2.
export type DemoPersistenceMode = 'client' | 'server';
