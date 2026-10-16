import { ChoiceControl } from '../../../shared/table-system/renderers/choice-control';
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
import {
  OperationController,
  Operation,
} from '../../../shared/table-system/operations/operation-controller';
import { Choice } from '../../../shared/table-system/presentation/display';
import { LabRow } from '../domain/lab-row';
import { CategoryCommand, canEditAmount } from '../domain/lab-operations';
export interface ChoiceContext {
  readonly controller: OperationController<LabRow>;
  readonly category: Operation<LabRow, CategoryCommand>;
}
@Component({
  selector: 'tsys-choice-cell',
  imports: [ChoiceControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (cellAction(); as action) {
    <tsys-choice-control
      [choices]="choices"
      [value]="cellContent()"
      [label]="'Category ' + id()"
      [disabled]="!action.allowed() || action.status().kind === 'pending'"
      [description]="cellError()"
      (selection)="select($event)"
    />
    @if (cellError(); as message) {
      <span class="tsys-error" role="alert">{{ message }}</span>
    }
  }`,
})
export class ChoiceCell implements ICellRendererAngularComp {
  private readonly destroy = inject(DestroyRef);
  private readonly facts = signal<ChoiceContext | null>(null);
  private readonly binding = signal<DirectBinding<LabRow, CategoryCommand> | null>(null);
  readonly id = signal('');
  readonly chosen = signal<LabRow['category']>('parts');
  readonly cellContent = computed(
    () => this.facts()?.controller.model.lookup(this.id())?.category ?? 'parts',
  );
  readonly cellAction = computed(() => this.binding());
  readonly cellError = computed(() => {
    const state = this.binding()?.status();
    return state?.kind === 'failed' ? state.message : '';
  });
  readonly choices: readonly Choice<LabRow['category']>[] = [
    { value: 'parts', label: 'Parts' },
    { value: 'labor', label: 'Labor' },
    { value: 'other', label: 'Other', disabled: true },
  ];
  constructor() {
    this.destroy.onDestroy(() => this.binding()?.release());
  }
  agInit(params: ICellRendererParams<LabRow, LabRow['category'], ChoiceContext>): void {
    this.binding()?.release();
    this.facts.set(params.context);
    if (!params.data || params.node.group || params.node.rowPinned) {
      this.binding.set(null);
      return;
    }
    const id = params.data.id;
    const controller = params.context.controller;
    this.id.set(id);
    this.binding.set(
      new DirectBinding(
        controller,
        params.context.category,
        { entityId: id, operation: 'category' },
        () => canEditAmount(controller.model, id),
        () => ({
          id,
          category: this.chosen(),
          baseRevision: controller.model.lookup(id)!.revision,
        }),
      ),
    );
  }
  refresh(params: ICellRendererParams<LabRow, LabRow['category'], ChoiceContext>): boolean {
    this.agInit(params);
    return true;
  }
  select(value: LabRow['category']): void {
    const choice = this.choices.find((c) => c.value === value);
    if (!choice || choice.disabled) return;
    this.chosen.set(choice.value);
    void this.binding()?.activate();
  }
}
