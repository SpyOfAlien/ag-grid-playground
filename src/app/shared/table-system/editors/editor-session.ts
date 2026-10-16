import { signal } from '@angular/core';
import { CellAddress, EditTarget, RowIdentity } from '../model/table-model';
import {
  Operation,
  OperationController,
  SubmissionOutcome,
} from '../operations/operation-controller';
export interface SessionIdentity {
  readonly id: number;
  readonly address: CellAddress;
  readonly closed: boolean;
  close(): void;
}
export class EditorSession<V> implements SessionIdentity {
  private readonly errorState = signal('');
  private readonly pendingState = signal(false);
  private readonly closeListeners = new Set<() => void>();
  readonly error = this.errorState.asReadonly();
  readonly pending = this.pendingState.asReadonly();
  private closedState = false;
  get closed(): boolean {
    return this.closedState;
  }
  constructor(
    readonly id: number,
    readonly address: CellAddress,
    readonly initial: V,
    private readonly execute: (value: V, action: string) => Promise<SubmissionOutcome>,
    private readonly finished: (session: SessionIdentity) => void,
  ) {}
  async save(value: V, action = 'save'): Promise<SubmissionOutcome> {
    if (this.closed) return { kind: 'stale' };
    if (this.pending()) return { kind: 'busy' };
    this.errorState.set('');
    this.pendingState.set(true);
    try {
      const outcome = await this.execute(value, action);
      if (outcome.kind === 'committed') this.close();
      else if (outcome.kind === 'failed') this.errorState.set(outcome.message);
      else if (outcome.kind === 'denied')
        this.errorState.set('Permission changed. This action is no longer allowed.');
      else if (outcome.kind === 'busy')
        this.errorState.set('Another operation is pending. Retry after it completes.');
      else this.close();
      return outcome;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid draft';
      this.errorState.set(message);
      return { kind: 'failed', message, conflict: false };
    } finally {
      this.pendingState.set(false);
    }
  }
  onClose(callback: () => void): () => void {
    if (this.closed) {
      callback();
      return () => {};
    }
    this.closeListeners.add(callback);
    return () => this.closeListeners.delete(callback);
  }
  close(): void {
    if (this.closed) return;
    this.closedState = true;
    this.finished(this);
    for (const listener of [...this.closeListeners]) listener();
    this.closeListeners.clear();
  }
}
export type OpenSession<V> =
  | { readonly kind: 'opened'; readonly session: EditorSession<V> }
  | { readonly kind: 'already-open' | 'unavailable' };
export class EditorSessions<R extends RowIdentity> {
  private readonly activeState = signal<SessionIdentity | null>(null);
  private sequence = 0;
  private destroyed = false;
  readonly active = this.activeState.asReadonly();
  constructor(private readonly controller: OperationController<R>) {}
  open<V, C>(
    address: CellAddress,
    initial: V,
    operation: Operation<R, C>,
    target: EditTarget,
    command: (value: V, action: string) => C,
  ): OpenSession<V> {
    if (this.destroyed || !this.controller.model.lookup(address.rowId))
      return { kind: 'unavailable' };
    if (this.active()) return { kind: 'already-open' };
    const generation = this.controller.model.dataset().generation;
    const captured = structuredClone(initial);
    const session = new EditorSession(
      ++this.sequence,
      address,
      captured,
      (value, action) =>
        generation === this.controller.model.dataset().generation
          ? this.controller.submit(operation, target, command(value, action))
          : Promise.resolve({ kind: 'stale' }),
      (closed) => {
        if (this.active()?.id === closed.id) this.activeState.set(null);
      },
    );
    this.activeState.set(session);
    return { kind: 'opened', session };
  }
  reset(): void {
    this.active()?.close();
  }
  destroy(): void {
    this.destroyed = true;
    this.reset();
  }
}
