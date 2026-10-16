import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import type { EditCommand } from '../../shared/grid-cells/editing/edit-command.model';
import { DemoTableState } from './demo-table-state';
import { authorizeDemoEdit, buildDemoPayload, type DemoEdit } from './demo-edit-intent';
import { normalizeDemoResponse } from './api/demo-api.model';
import {
  DemoEditError,
  type DemoActionData,
  type DemoEditCompletion,
  type DemoTablePersistence,
} from './demo-persistence.model';
import { DEMO_CLIENT_STRATEGY } from './demo-client-strategy';

/** Synchronous local commit behind the same promise contract as server actions. */
@Injectable()
export class DemoClientPersistence implements DemoTablePersistence {
  private readonly table = inject(DemoTableState);
  private readonly lifetime = inject(DestroyRef);
  private readonly strategy = inject(DEMO_CLIENT_STRATEGY);
  private readonly completionSource = signal<DemoEditCompletion | null>(null);
  readonly pending = signal(0).asReadonly();
  readonly completion = this.completionSource.asReadonly();

  applyReviewDemo(command: EditCommand<DemoActionData['applyReviewDemo']>): Promise<void> {
    return this.save({ action: 'applyReviewDemo', command });
  }

  saveName(command: EditCommand<DemoActionData['saveName']>): Promise<void> {
    return this.save({ action: 'saveName', command });
  }

  saveAmount(command: EditCommand<DemoActionData['saveAmount']>): Promise<void> {
    return this.save({ action: 'saveAmount', command });
  }

  saveNotes(command: EditCommand<DemoActionData['saveNotes']>): Promise<void> {
    return this.save({ action: 'saveNotes', command });
  }

  saveReview(command: EditCommand<DemoActionData['saveReview']>): Promise<void> {
    return this.save({ action: 'saveReview', command });
  }

  saveUnit(command: EditCommand<DemoActionData['saveUnit']>): Promise<void> {
    return this.save({ action: 'saveUnit', command });
  }

  saveDetails(command: EditCommand<DemoActionData['saveDetails']>): Promise<void> {
    return this.save({ action: 'saveDetails', command });
  }

  approveDetails(command: EditCommand<DemoActionData['approveDetails']>): Promise<void> {
    return this.save({ action: 'approveDetails', command });
  }

  private async save(edit: DemoEdit): Promise<void> {
    try {
      if (this.lifetime.destroyed)
        throw new DemoEditError('feature-destroyed', 'The table was destroyed.');
      const { rowId, columnId } = edit.command.cell;
      if (!rowId || !columnId)
        throw new DemoEditError('invalid-command', 'A row ID and column ID are required.');
      const row = this.table.getRow(rowId);
      if (!row) throw new DemoEditError('missing-row', 'The edited row no longer exists.');
      if (edit.action === 'applyReviewDemo' && this.table.mode() === 'server')
        throw new DemoEditError('denied', 'This shortcut is client-only.');
      authorizeDemoEdit(edit.action, columnId, row);
      const payload = buildDemoPayload(edit, row);
      // Local business calculation includes normalization and the dependent row.
      const update = normalizeDemoResponse(
        payload,
        edit.action === 'approveDetails',
        this.table.rows(),
      ).update;
      if (update.kind !== 'replace-rows')
        throw new DemoEditError('invalid-response', 'Invalid local calculation.');
      this.table.commitClientRows(update.rows, this.strategy);
      this.completionSource.set({
        kind: 'success',
        action: edit.action,
        cell: { ...edit.command.cell },
      });
    } catch (error: unknown) {
      const failure =
        error instanceof DemoEditError
          ? error
          : new DemoEditError(
              'grid-unavailable',
              error instanceof Error ? error.message : String(error),
            );
      if (!this.lifetime.destroyed)
        this.completionSource.set({
          kind: 'failure',
          action: edit.action,
          cell: { ...edit.command.cell },
          error: failure,
        });
      throw failure;
    }
  }
}
