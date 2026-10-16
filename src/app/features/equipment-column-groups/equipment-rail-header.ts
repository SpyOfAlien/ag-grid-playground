import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { IHeaderAngularComp } from 'ag-grid-angular';
import type { IHeaderParams } from 'ag-grid-community';
import type { EquipmentRow } from './equipment-data';

interface RailHeaderParams extends IHeaderParams<EquipmentRow> {
  changeCount: number;
}

@Component({
  selector: 'app-equipment-rail-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="change-count" [attr.aria-label]="changeCount() + ' changes'">{{
      changeCount()
    }}</span>
    <span class="rail-label">{{ label() }}</span>
  `,
  styles: `
    :host {
      display: flex;
      width: 100%;
      height: max-content;
      align-items: center;
      flex-direction: column;
      gap: 8px;
      padding: 6px 0;
    }

    .change-count {
      background: #f04438;
      color: white;
      border-radius: 4px;
      min-width: 20px;
      height: 20px;
      text-align: center;
      line-height: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .rail-label {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      font-size: 14px;
      line-height: 20px;
      font-weight: 500;
      white-space: nowrap;
    }
  `,
})
export class EquipmentRailHeader implements IHeaderAngularComp {
  protected readonly label = signal('');
  protected readonly changeCount = signal(0);

  agInit(params: RailHeaderParams): void {
    this.refresh(params);
  }

  refresh(params: RailHeaderParams): boolean {
    this.label.set(params.displayName);
    this.changeCount.set(params.changeCount);
    return true;
  }
}
