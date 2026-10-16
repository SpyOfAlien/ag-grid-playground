import { InjectionToken, type Signal } from '@angular/core';
import type { CellIdentity, EditCommand } from '../../shared/grid-cells/editing/edit-command.model';
import type { DemoRow } from './demo-row.model';

export interface DemoAmountEdit {
  readonly value: number | null;
}

export interface DemoDetailsEdit {
  readonly name: string;
  readonly amount: number | null;
  readonly notes: string;
  readonly revision: number;
}

export interface DemoActionData {
  readonly applyReviewDemo: Record<string, never>;
  readonly saveName: { readonly value: string | null };
  readonly saveAmount: DemoAmountEdit;
  readonly saveNotes: { readonly value: string };
  readonly saveReview: { readonly value: boolean };
  readonly saveUnit: { readonly value: DemoRow['metadata']['unit'] };
  readonly saveDetails: DemoDetailsEdit;
  readonly approveDetails: DemoDetailsEdit;
}

export type DemoEditAction = keyof DemoActionData;

export type DemoEditErrorCode =
  | 'invalid-command'
  | 'missing-row'
  | 'denied'
  | 'revision-conflict'
  | 'stale-dataset'
  | 'feature-destroyed'
  | 'server-error'
  | 'invalid-response'
  | 'grid-unavailable';

export class DemoEditError extends Error {
  constructor(
    readonly code: DemoEditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DemoEditError';
  }
}

export type DemoEditCompletion =
  | { readonly kind: 'success'; readonly action: DemoEditAction; readonly cell: CellIdentity }
  | {
      readonly kind: 'failure';
      readonly action: DemoEditAction;
      readonly cell: CellIdentity;
      readonly error: DemoEditError;
    };

export interface DemoTablePersistence {
  readonly pending: Signal<number>;
  readonly completion: Signal<DemoEditCompletion | null>;
  saveName(command: EditCommand<DemoActionData['saveName']>): Promise<void>;
  saveAmount(command: EditCommand<DemoActionData['saveAmount']>): Promise<void>;
  saveNotes(command: EditCommand<DemoActionData['saveNotes']>): Promise<void>;
  saveReview(command: EditCommand<DemoActionData['saveReview']>): Promise<void>;
  saveUnit(command: EditCommand<DemoActionData['saveUnit']>): Promise<void>;
  saveDetails(command: EditCommand<DemoActionData['saveDetails']>): Promise<void>;
  /** Submit the current details draft and approve it through the approval endpoint. */
  approveDetails(command: EditCommand<DemoActionData['approveDetails']>): Promise<void>;
}

export const DEMO_TABLE_PERSISTENCE = new InjectionToken<DemoTablePersistence>(
  'Demo table persistence',
);
