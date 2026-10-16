import { authorizeDemoEdit, buildDemoPayload, type DemoEdit } from './demo-edit-intent';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type { EditCommand } from '@grid-cells';
import { DemoTableState } from './demo-table-state';
import {
  DemoEditError,
  type DemoActionData,
  type DemoEditAction,
  type DemoEditCompletion,
  type DemoTablePersistence,
} from './demo-persistence.model';
import { readDemoResponse } from './api/demo-api.model';
import { demoHttpParams } from './api/demo-http-params';
import { DEMO_DATASET } from './api/demo-api-scenarios';

/** Feature persistence owns ordering, transport and committing its authoritative row set. */
@Injectable()
export class DemoServerPersistence implements DemoTablePersistence {
  private readonly table = inject(DemoTableState);
  private readonly http = inject(HttpClient);
  private readonly lifetime = inject(DestroyRef);

  private readonly pendingSource = signal(0);
  private readonly completionSource = signal<DemoEditCompletion | null>(null);
  readonly pending = this.pendingSource.asReadonly();
  readonly completion = this.completionSource.asReadonly();

  private tail: Promise<void> = Promise.resolve();
  private readonly rejectOnDestroy = new Set<() => void>();

  constructor() {
    this.lifetime.onDestroy(() => {
      for (const reject of this.rejectOnDestroy) reject();
      this.rejectOnDestroy.clear();
    });
  }

  saveName(command: EditCommand<DemoActionData['saveName']>): Promise<void> {
    return this.enqueue({ action: 'saveName', command });
  }

  saveAmount(command: EditCommand<DemoActionData['saveAmount']>): Promise<void> {
    return this.enqueue({ action: 'saveAmount', command });
  }

  saveNotes(command: EditCommand<DemoActionData['saveNotes']>): Promise<void> {
    return this.enqueue({ action: 'saveNotes', command });
  }

  saveReview(command: EditCommand<DemoActionData['saveReview']>): Promise<void> {
    return this.enqueue({ action: 'saveReview', command });
  }

  saveUnit(command: EditCommand<DemoActionData['saveUnit']>): Promise<void> {
    return this.enqueue({ action: 'saveUnit', command });
  }

  saveDetails(command: EditCommand<DemoActionData['saveDetails']>): Promise<void> {
    return this.enqueue({ action: 'saveDetails', command });
  }

  approveDetails(command: EditCommand<DemoActionData['approveDetails']>): Promise<void> {
    return this.enqueue({ action: 'approveDetails', command });
  }

  private enqueue(edit: DemoEdit): Promise<void> {
    if (this.lifetime.destroyed)
      return Promise.reject(new DemoEditError('feature-destroyed', 'The table was destroyed.'));
    // Feature intents contain only plain scalar data and query arrays.
    const captured = structuredClone(edit);
    const generation = this.table.getDatasetGeneration();
    this.pendingSource.update((count) => count + 1);
    let rejectDestroyed!: () => void;
    const destroyed = new Promise<never>((_resolve, reject) => {
      rejectDestroyed = () =>
        reject(new DemoEditError('feature-destroyed', 'The table was destroyed.'));
      this.rejectOnDestroy.add(rejectDestroyed);
    });
    const work = this.tail.then(() => this.execute(captured, generation));
    const committed = Promise.race([work, destroyed]);
    // Keep a failed action from blocking the next one. Only feature destruction ends the queue.
    this.tail = committed.then(
      () => undefined,
      () => undefined,
    );
    return committed
      .catch((error: unknown) => {
        const failure = this.failure(error);
        if (!this.lifetime.destroyed)
          this.completionSource.set({
            kind: 'failure',
            action: captured.action,
            cell: captured.command.cell,
            error: failure,
          });
        throw failure;
      })
      .finally(() => {
        this.rejectOnDestroy.delete(rejectDestroyed);
        this.pendingSource.update((count) => count - 1);
      });
  }

  private assertCurrent(generation: number): void {
    if (this.lifetime.destroyed)
      throw new DemoEditError('feature-destroyed', 'The table was destroyed.');
    if (this.table.getDatasetGeneration() !== generation)
      throw new DemoEditError('stale-dataset', 'The dataset changed while the edit was pending.');
  }

  private async execute(edit: DemoEdit, generation: number): Promise<void> {
    this.assertCurrent(generation);
    const { rowId, columnId } = edit.command.cell;
    if (!rowId || !columnId)
      throw new DemoEditError('invalid-command', 'A row ID and column ID are required.');
    const row = this.table.getRow(rowId);
    if (!row) throw new DemoEditError('missing-row', 'The edited row no longer exists.');
    authorizeDemoEdit(edit.action, columnId, row);
    const body = buildDemoPayload(edit, row);
    const details = edit.action === 'saveDetails' || edit.action === 'approveDetails';
    const endpoint = edit.action === 'approveDetails' ? 'approve' : details ? 'details' : 'fields';
    const query = details
      ? { ...edit.command.queryParams, revision: row.metadata.revision }
      : (edit.command.queryParams ?? {});
    const response = await firstValueFrom(
      this.http.request<unknown>(
        edit.action === 'approveDetails' ? 'POST' : 'PATCH',
        `/api/cell-kit-demo/rows/${encodeURIComponent(rowId)}/${endpoint}`,
        {
          body,
          params: demoHttpParams(query),
          context: new HttpContext().set(DEMO_DATASET, this.table.rows()),
        },
      ),
    );
    this.assertCurrent(generation);
    const update = readDemoResponse(response);
    this.table.commitServerUpdate(update);
    this.completionSource.set({ kind: 'success', action: edit.action, cell: edit.command.cell });
  }

  private failure(error: unknown): DemoEditError {
    if (error instanceof DemoEditError) return error;
    if (error instanceof HttpErrorResponse) {
      const body: unknown = error.error;
      const message =
        typeof body === 'object' && body !== null ? Reflect.get(body, 'message') : undefined;
      return new DemoEditError(
        error.status === 409 ? 'revision-conflict' : 'server-error',
        typeof message === 'string' ? message : 'The server could not save this edit.',
      );
    }
    return new DemoEditError(
      'invalid-response',
      error instanceof Error ? error.message : String(error),
    );
  }
}
