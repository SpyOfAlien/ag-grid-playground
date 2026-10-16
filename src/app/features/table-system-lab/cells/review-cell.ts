import { bindReview } from './review-binding';
import { SwitchControl } from '../../../shared/table-system/renderers/switch-control';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { DirectBinding } from '../../../shared/table-system/interactions/direct-binding';
import { OperationController } from '../../../shared/table-system/operations/operation-controller';
import { Operation } from '../../../shared/table-system/operations/operation-controller';
import { LabRow } from '../domain/lab-row';
import { canReview, ReviewCommand } from '../domain/lab-operations';
export interface ReviewContext {
  readonly controller: OperationController<LabRow>;
  readonly review: Operation<LabRow, ReviewCommand>;
}
@Component({
  selector: 'tsys-review-cell',
  imports: [SwitchControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (cellAction(); as action) {
    <tsys-switch-control [action]="action" [checked]="cellContent()" [label]="cellLabel()" />
    @if (cellError(); as message) {
      <span class="tsys-error" role="alert">{{ message }}</span
      ><button type="button" aria-label="Dismiss review error" (click)="action.dismiss()">
        Dismiss
      </button>
    }
  }`,
})
export class ReviewCell implements ICellRendererAngularComp {
  private readonly destroy = inject(DestroyRef);
  private readonly rowId = signal('');
  private readonly binding = signal<DirectBinding<LabRow, ReviewCommand> | null>(null);
  readonly cellAction = computed(() => this.binding());
  readonly cellContent = computed(() => {
    const binding = this.binding();
    return binding
      ? (this.context!.controller.model.lookup(this.rowId())?.reviewed ?? false)
      : false;
  });
  readonly cellLabel = computed(() => `Review ${this.rowId()}`);
  readonly cellError = computed(() => {
    const state = this.binding()?.status();
    return state?.kind === 'failed' ? state.message : '';
  });
  private context?: ReviewContext;
  constructor() {
    this.destroy.onDestroy(() => this.binding()?.release());
  }
  agInit(params: ICellRendererParams<LabRow, boolean, ReviewContext>): void {
    this.binding()?.release();
    this.context = params.context;
    if (!params.data || params.node.group || params.node.rowPinned) {
      this.binding.set(null);
      return;
    }
    const id = params.data.id;
    const controller = params.context.controller;
    this.rowId.set(id);
    const binding = bindReview(params.context, id);
    this.binding.set(binding);
  }
  refresh(params: ICellRendererParams<LabRow, boolean, ReviewContext>): boolean {
    this.agInit(params);
    return true;
  }
}
