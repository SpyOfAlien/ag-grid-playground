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
import { RowIdentity } from '../model/table-model';
import type { TableColumn } from '../ag-grid/typed-columns';
import { EditorBinding, TableInteractionContext } from '../interactions/editor-binding';
import { computeDescription, computeMarker } from '../presentation/display';
export type TypedCellParams<R extends RowIdentity, V, C> = ICellRendererParams<
  R,
  V,
  { readonly tableSystem?: TableInteractionContext<R> }
> & { readonly tableColumn: TableColumn<R, V, C> };
@Component({
  selector: 'tsys-value-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (cellAction(); as action) {
      <button
        type="button"
        [attr.aria-label]="action.label"
        [attr.aria-description]="cellDescription()"
        [disabled]="!action.allowed || action.pending"
        (click)="open($event)"
      >
        {{ cellContent() }}
        @if (cellMarker(); as marker) {
          <span aria-hidden="true" [attr.title]="marker.text">⚠</span>
        }
      </button>
    } @else {
      <span [attr.aria-label]="cellDescription()"
        >{{ cellContent() }}
        @if (cellMarker(); as marker) {
          <span aria-hidden="true" [attr.title]="marker.text">⚠</span>
        }
      </span>
    }`,
})
export class TypedValueCell<
  R extends RowIdentity = RowIdentity,
  V = unknown,
  C = never,
> implements ICellRendererAngularComp {
  private readonly destroy = inject(DestroyRef);
  private readonly binding = signal<EditorBinding<R, V, C> | null>(null);
  private readonly facts = signal<TypedCellParams<R, V, C> | null>(null);
  readonly cellContent = computed(() => {
    const facts = this.facts();
    return facts?.data ? facts.tableColumn.display(facts.tableColumn.value(facts.data)) : '';
  });
  readonly cellAnnotations = computed(() => {
    const facts = this.facts();
    const state = this.binding()?.status();
    return [
      ...(state?.kind === 'failed' ? [{ kind: 'error' as const, text: state.message }] : []),
      ...(facts?.data
        ? (facts.tableColumn.annotations?.(facts.data, facts.tableColumn.value(facts.data)) ?? [])
        : []),
    ];
  });
  readonly cellAction = computed(() => {
    const binding = this.binding();
    return binding
      ? {
          allowed: binding.allowed(),
          label: binding.label(),
          pending: binding.status().kind === 'pending',
        }
      : null;
  });
  readonly cellMarker = computed(() => computeMarker(this.cellAnnotations()));
  readonly cellDescription = computed(
    () => `${this.cellContent()}. ${computeDescription(this.cellAnnotations())}`,
  );
  constructor() {
    this.destroy.onDestroy(() => this.binding()?.release());
  }
  agInit(params: TypedCellParams<R, V, C>): void {
    this.binding()?.release();
    this.binding.set(null);
    this.facts.set({ ...params });
    if (
      params.data &&
      !params.node?.group &&
      !params.node?.rowPinned &&
      params.tableColumn.interaction &&
      params.tableColumn.editor &&
      params.context?.tableSystem
    )
      this.binding.set(
        new EditorBinding(params.context.tableSystem, params.tableColumn, {
          rowId: params.data.id,
          columnId: params.column?.getColId() ?? params.tableColumn.id,
        }),
      );
  }
  refresh(params: TypedCellParams<R, V, C>): boolean {
    this.agInit(params);
    return true;
  }
  open(event: MouseEvent): void {
    this.binding()?.activate(event.currentTarget as HTMLElement);
  }
}
