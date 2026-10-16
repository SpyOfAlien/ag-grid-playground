import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';

type RowRecord = Record<string, unknown>;

export interface RevisedCellParams<TData = RowRecord> extends ICellRendererParams<TData, string> {
  /** Row field that holds the value before the change. */
  previousField: keyof TData & string;
}

/** Previous value for the cell, or null when the value hasn't changed. */
export function computePreviousValue<TData>(
  data: TData | undefined,
  previousField: keyof TData,
): string | null {
  const previous = data?.[previousField];
  return previous == null ? null : String(previous);
}

function computeRevisedContent(params: RevisedCellParams | null) {
  return {
    value: params?.value ?? '',
    previous: params ? computePreviousValue(params.data, params.previousField) : null,
  };
}

/**
 * Shows the previous value (struck through) above the current one.
 * Columns pick it through cellRendererSelector only for revised cells;
 * other cells keep AG Grid's plain text rendering.
 */
@Component({
  selector: 'app-revised-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="previous"
      ><span class="sr-only">Previous value: </span>{{ cellContent().previous }}</span
    >
    <span class="current"><span class="sr-only">New value: </span>{{ cellContent().value }}</span>
  `,
  styles: `
    :host {
      display: flex;
      height: 100%;
      flex-direction: column;
      justify-content: center;
      line-height: 20px;
    }
    /* One step darker than the design (#717680, #d92d20) to meet WCAG AA on the #fef3f2 background. */
    .previous {
      color: #535862;
      font-size: 12px;
      line-height: 16px;
      text-decoration: line-through;
    }
    .current {
      color: #b42318;
      font-weight: 500;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `,
})
export class RevisedCell implements ICellRendererAngularComp {
  private readonly params = signal<RevisedCellParams | null>(null);
  protected readonly cellContent = computed(() => computeRevisedContent(this.params()));

  agInit(params: RevisedCellParams): void {
    this.params.set(params);
  }

  // AG Grid re-runs cellRendererSelector before calling refresh, so this only runs
  // while the cell is still revised; otherwise the grid swaps in plain text itself.
  refresh(params: RevisedCellParams): boolean {
    this.params.set(params);
    return true;
  }
}
