/** Trimmed copy of the signal project's model: only what the rail-header-label demo needs. */

export interface SignalGroup {
  code: string;
  name: string;
  parentCode: string | null;
  orderNo: number;
}

export interface SignalColumn {
  code: string;
  name: string;
  groupCode: string | null;
  orderNo: number;
  /** Picked from a list in the filter row instead of searched. */
  selectFilter?: boolean;
}

export interface SignalRow {
  signalId: string;
  revisionLabel: string;
  data: Record<string, string>;
  /** Codes of the cells changed since the last revision. */
  modifiedCodes: string[];
}

export type SignalStructureNode =
  | { kind: 'column'; column: SignalColumn }
  | { kind: 'group'; group: SignalGroup; depth: number; children: SignalStructureNode[] };
