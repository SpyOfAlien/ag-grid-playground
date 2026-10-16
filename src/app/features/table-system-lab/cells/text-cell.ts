import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import {
  Annotation,
  computeDescription,
  computeMarker,
  computeText,
} from '../../../shared/table-system/presentation/display';
import { LabRow } from '../domain/lab-row';
@Component({
  selector: 'tsys-text-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class.tsys-muted]="muted()" [attr.aria-label]="cellDescription()"
    >{{ cellContent() }}
    @if (cellMarker(); as marker) {
      <span aria-hidden="true" [attr.title]="marker.text"> ⚠</span>
    }
  </span>`,
})
export class TextCell implements ICellRendererAngularComp {
  private readonly facts = signal<{
    value: string | null | undefined;
    row: LabRow | undefined;
    muted: () => boolean;
  } | null>(null);
  readonly cellContent = computed(() => computeText(this.facts()?.value));
  readonly cellAnnotations = computed<readonly Annotation[]>(() => {
    const row = this.facts()?.row;
    return row
      ? [
          ...(row.locked
            ? [
                {
                  kind: 'warning' as const,
                  text: 'Amount and category are locked; review remains available',
                },
              ]
            : []),
          ...(row.note ? [{ kind: 'info' as const, text: row.note }] : []),
        ]
      : [];
  });
  readonly cellMarker = computed(() => computeMarker(this.cellAnnotations()));
  readonly cellDescription = computed(
    () => `${this.cellContent()}. ${computeDescription(this.cellAnnotations())}`,
  );
  readonly muted = computed(() => this.facts()?.muted() ?? false);
  agInit(params: ICellRendererParams<LabRow, string, { muted: () => boolean }>): void {
    this.facts.set({ value: params.value, row: params.data, muted: params.context.muted });
  }
  refresh(params: ICellRendererParams<LabRow, string, { muted: () => boolean }>): boolean {
    this.agInit(params);
    return true;
  }
}
