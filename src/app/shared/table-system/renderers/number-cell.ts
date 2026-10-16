import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { computeNumber, NumberDisplay } from '../presentation/display';
export interface NumberCellContext {
  readonly display: () => NumberDisplay;
}
@Component({
  selector: 'tsys-number-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="tsys-number">{{ cellContent() }}</span>`,
})
export class NumberCell implements ICellRendererAngularComp {
  private readonly facts = signal<{
    value: number | null | undefined;
    context: NumberCellContext;
  } | null>(null);
  readonly cellContent = computed(() => {
    const facts = this.facts();
    return facts ? computeNumber(facts.value, facts.context.display()) : '';
  });
  agInit(params: ICellRendererParams<unknown, number | null, NumberCellContext>): void {
    this.facts.set({ value: params.value, context: params.context });
  }
  refresh(params: ICellRendererParams<unknown, number | null, NumberCellContext>): boolean {
    this.agInit(params);
    return true;
  }
}
