import { OperationStatus } from '../../../shared/table-system/operations/operation-controller';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  Signal,
} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { DirectBinding } from '../../../shared/table-system/interactions/direct-binding';
import { SwitchControl } from '../../../shared/table-system/renderers/switch-control';
import { computeNumber } from '../../../shared/table-system/presentation/display';
import { LabRow } from '../domain/lab-row';
import { ReviewCommand } from '../domain/lab-operations';
import { ReviewContext } from './review-cell';
import { AmountContext } from './amount-context';
import { bindReview } from './review-binding';
@Component({
  selector: 'tsys-toggle-number-cell',
  imports: [SwitchControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (cellAction(); as action) {
    <tsys-switch-control
      [action]="action"
      [checked]="cellReviewed()"
      [label]="'Composite review ' + id()"
    /><button
      type="button"
      [attr.aria-label]="'Composite amount ' + id()"
      [disabled]="!cellEditable()"
      [attr.aria-description]="cellAmountDescription()"
      (click)="open($event)"
    >
      {{ cellContent() }}
    </button>
  }`,
})
export class ToggleNumberCell implements ICellRendererAngularComp {
  private readonly destroy = inject(DestroyRef);
  private readonly facts = signal<(ReviewContext & AmountContext) | null>(null);
  private readonly binding = signal<DirectBinding<LabRow, ReviewCommand> | null>(null);
  private readonly amountObservation = signal<{
    readonly status: Signal<OperationStatus>;
    readonly release: () => void;
  } | null>(null);
  readonly id = signal('');
  readonly cellContent = computed(() => {
    const context = this.facts();
    return context
      ? computeNumber(context.controller.model.lookup(this.id())?.amount, context.display())
      : '';
  });
  readonly cellAction = computed(() => this.binding());
  readonly cellReviewed = computed(
    () => this.facts()?.controller.model.lookup(this.id())?.reviewed ?? false,
  );
  readonly cellEditable = computed(
    () =>
      (this.facts()?.canEditAmount(this.id()) ?? false) &&
      this.amountObservation()?.status().kind !== 'pending',
  );
  readonly cellAmountDescription = computed(() => {
    const state = this.amountObservation()?.status();
    return state?.kind === 'failed'
      ? state.message
      : state?.kind === 'pending'
        ? 'Save pending'
        : '';
  });
  constructor() {
    this.destroy.onDestroy(() => {
      this.binding()?.release();
      this.amountObservation()?.release();
    });
  }
  agInit(params: ICellRendererParams<LabRow, number | null, ReviewContext & AmountContext>): void {
    this.binding()?.release();
    this.amountObservation()?.release();
    this.amountObservation.set(null);
    this.facts.set(params.context);
    if (!params.data || params.node.group || params.node.rowPinned) {
      this.binding.set(null);
      return;
    }
    this.id.set(params.data.id);
    this.amountObservation.set(
      params.context.controller.observe({ entityId: params.data.id, operation: 'amount' }),
    );
    this.binding.set(bindReview(params.context, params.data.id));
  }
  refresh(
    params: ICellRendererParams<LabRow, number | null, ReviewContext & AmountContext>,
  ): boolean {
    this.agInit(params);
    return true;
  }
  open(event: MouseEvent): void {
    const context = this.facts();
    if (context?.canEditAmount(this.id()))
      context.editAmount(this.id(), event.currentTarget as HTMLElement, undefined, {
        rowId: this.id(),
        columnId: 'composite',
      });
  }
}
