import { Signal } from '@angular/core';
import { EditTarget, RowIdentity } from '../model/table-model';
import {
  Operation,
  OperationController,
  OperationStatus,
  SubmissionOutcome,
} from '../operations/operation-controller';
export class DirectBinding<R extends RowIdentity, C> {
  readonly status: Signal<OperationStatus>;
  readonly release: () => void;
  constructor(
    private readonly controller: OperationController<R>,
    private readonly operation: Operation<R, C>,
    readonly target: EditTarget,
    readonly allowed: () => boolean,
    private readonly command: () => C,
  ) {
    const observation = controller.observe(target);
    this.status = observation.status;
    this.release = observation.release;
  }
  activate(): Promise<SubmissionOutcome> {
    return this.allowed()
      ? this.controller.submit(this.operation, this.target, this.command())
      : Promise.resolve({ kind: 'denied' });
  }
  dismiss(): void {
    this.controller.dismiss(this.target);
  }
}
