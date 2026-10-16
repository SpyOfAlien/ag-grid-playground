import { RevisionConflictError } from '../model/errors';
import { signal, Signal, WritableSignal } from '@angular/core';
import { EditTarget, RowIdentity, TableModel, TableUpdate } from '../model/table-model';
export type ConflictScope =
  { readonly kind: 'entity'; readonly id: string } | { readonly kind: 'table' };
export type OperationStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending'; readonly submissionId: number }
  | { readonly kind: 'failed'; readonly message: string; readonly conflict: boolean };
export type SubmissionOutcome =
  | { readonly kind: 'committed'; readonly submissionId: number }
  | { readonly kind: 'busy' | 'stale' | 'denied' }
  | { readonly kind: 'failed'; readonly message: string; readonly conflict: boolean };
export interface Operation<R extends RowIdentity, C> {
  readonly name: string;
  readonly scope: (command: C) => ConflictScope;
  readonly authorize: (command: C, model: TableModel<R>) => boolean;
  readonly validate: (command: C, model: TableModel<R>) => void;
  readonly execute: (
    command: C,
    model: TableModel<R>,
    abort: AbortSignal,
  ) => Promise<TableUpdate<R>>;
}
interface StatusEntry {
  readonly state: WritableSignal<OperationStatus>;
  subscribers: number;
}
interface Pending {
  readonly id: number;
  readonly scope: ConflictScope;
  readonly abort: AbortController;
  readonly state: WritableSignal<OperationStatus>;
}
export function computeTargetKey(target: EditTarget): string {
  return JSON.stringify([target.entityId, target.operation]);
}
export function computeScopesConflict(a: ConflictScope, b: ConflictScope): boolean {
  return a.kind === 'table' || b.kind === 'table' || a.id === b.id;
}
export class OperationController<R extends RowIdentity> {
  private readonly statuses = new Map<string, StatusEntry>();
  private readonly pending = new Map<string, Pending>();
  private sequence = 0;
  private disposed = false;
  private generation: number;
  private readonly feedbackState = signal<{
    readonly target: EditTarget;
    readonly message: string;
  } | null>(null);
  readonly feedback = this.feedbackState.asReadonly();
  private readonly completionState = signal<{ target: EditTarget; submissionId: number } | null>(
    null,
  );
  readonly completion = this.completionState.asReadonly();
  constructor(readonly model: TableModel<R>) {
    this.generation = model.dataset().generation;
  }
  observe(target: EditTarget): {
    readonly status: Signal<OperationStatus>;
    readonly release: () => void;
  } {
    this.invalidateIfReset();
    const key = computeTargetKey(target);
    const entry = this.entry(key);
    entry.subscribers++;
    let released = false;
    return {
      status: entry.state.asReadonly(),
      release: () => {
        if (released) return;
        released = true;
        entry.subscribers--;
        this.cleanup();
      },
    };
  }
  status(target: EditTarget): OperationStatus {
    this.invalidateIfReset();
    return this.statuses.get(computeTargetKey(target))?.state() ?? { kind: 'idle' };
  }
  dismiss(target: EditTarget): void {
    if (
      this.feedback()?.target.entityId === target.entityId &&
      this.feedback()?.target.operation === target.operation
    )
      this.feedbackState.set(null);
    const entry = this.statuses.get(computeTargetKey(target));
    if (entry?.state().kind === 'failed') entry.state.set({ kind: 'idle' });
    this.cleanup();
  }
  async submit<C>(
    operation: Operation<R, C>,
    target: EditTarget,
    command: C,
  ): Promise<SubmissionOutcome> {
    this.invalidateIfReset();
    if (this.disposed) return { kind: 'stale' };
    if (target.operation !== operation.name) throw new Error('Target operation mismatch');
    if (!operation.authorize(command, this.model)) return { kind: 'denied' };
    const key = computeTargetKey(target);
    if (this.pending.has(key)) return { kind: 'busy' };
    const entry = this.entry(key);
    try {
      operation.validate(command, this.model);
    } catch (error) {
      const outcome = this.failure(entry.state, error, target);
      this.cleanup();
      return outcome;
    }
    const scope = operation.scope(command);
    if (
      this.pending.has(key) ||
      [...this.pending.values()].some((p) => computeScopesConflict(scope, p.scope))
    )
      return { kind: 'busy' };
    const generation = this.model.dataset().generation;
    const pending: Pending = {
      id: ++this.sequence,
      scope,
      abort: new AbortController(),
      state: entry.state,
    };
    this.pending.set(key, pending);
    entry.state.set({ kind: 'pending', submissionId: pending.id });
    if (
      this.feedback()?.target.entityId === target.entityId &&
      this.feedback()?.target.operation === target.operation
    )
      this.feedbackState.set(null);
    try {
      const accepted = await operation.execute(command, this.model, pending.abort.signal);
      if (
        this.disposed ||
        generation !== this.model.dataset().generation ||
        this.pending.get(key) !== pending
      )
        return { kind: 'stale' };
      this.model.commit(accepted);
      entry.state.set({ kind: 'idle' });
      if (
        this.feedback()?.target.entityId === target.entityId &&
        this.feedback()?.target.operation === target.operation
      )
        this.feedbackState.set(null);
      this.completionState.set({ target, submissionId: pending.id });
      return { kind: 'committed', submissionId: pending.id };
    } catch (error) {
      if (
        this.disposed ||
        generation !== this.model.dataset().generation ||
        this.pending.get(key) !== pending
      )
        return { kind: 'stale' };
      return this.failure(entry.state, error, target);
    } finally {
      if (this.pending.get(key) === pending) this.pending.delete(key);
      this.cleanup();
    }
  }
  reset(): void {
    this.invalidate();
    this.generation = this.model.dataset().generation;
  }
  destroy(): void {
    this.disposed = true;
    this.invalidate();
  }
  private invalidateIfReset(): void {
    if (this.generation !== this.model.dataset().generation) this.reset();
  }
  private invalidate(): void {
    for (const p of this.pending.values()) {
      p.abort.abort();
      p.state.set({ kind: 'idle' });
    }
    this.pending.clear();
    for (const e of this.statuses.values()) e.state.set({ kind: 'idle' });
    this.completionState.set(null);
    this.feedbackState.set(null);
    this.cleanup();
  }
  private entry(key: string): StatusEntry {
    let entry = this.statuses.get(key);
    if (!entry) {
      entry = { state: signal<OperationStatus>({ kind: 'idle' }), subscribers: 0 };
      this.statuses.set(key, entry);
    }
    return entry;
  }
  private failure(
    state: WritableSignal<OperationStatus>,
    error: unknown,
    target: EditTarget,
  ): SubmissionOutcome {
    const message = error instanceof Error ? error.message : 'Save failed';
    const conflict = error instanceof RevisionConflictError;
    state.set({ kind: 'failed', message, conflict });
    this.feedbackState.set({ target, message });
    return { kind: 'failed', message, conflict };
  }
  private cleanup(): void {
    for (const [key, entry] of this.statuses)
      if (!entry.subscribers && entry.state().kind === 'idle' && !this.pending.has(key))
        this.statuses.delete(key);
    // Keep actionable failures, but bound entries without views to the most recent 256 targets.
    const failures = [...this.statuses].filter(
      ([, e]) => !e.subscribers && e.state().kind === 'failed',
    );
    for (const [key] of failures.slice(0, Math.max(0, failures.length - 256)))
      this.statuses.delete(key);
  }
}
