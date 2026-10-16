import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import type { ICellRendererAngularComp } from 'ag-grid-angular';
import type { ICellRendererParams } from 'ag-grid-community';
import type { EquipmentRow } from './equipment-data';

function computeEquipmentContent(params: ICellRendererParams<EquipmentRow, string> | null) {
  return {
    value: params?.value ?? '',
    previous:
      params?.colDef?.field === 'ward'
        ? (params.data?.previousWard ?? null)
        : (params?.data?.previousWardCode ?? null),
  };
}

@Component({
  selector: 'app-equipment-change-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (cellContent().previous; as previous) {
      <span class="previous"><span class="sr-only">Previous value: </span>{{ previous }}</span>
      <span class="current"><span class="sr-only">New value: </span>{{ cellContent().value }}</span>
    } @else {
      <span>{{ cellContent().value }}</span>
    }
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
export class EquipmentChangeCell implements ICellRendererAngularComp {
  private readonly params = signal<ICellRendererParams<EquipmentRow, string> | null>(null);
  protected readonly cellContent = computed(() => computeEquipmentContent(this.params()));

  agInit(params: ICellRendererParams<EquipmentRow, string>): void {
    this.refresh(params);
  }

  refresh(params: ICellRendererParams<EquipmentRow, string>): boolean {
    this.params.set(params);
    return true;
  }
}
