import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { IInnerHeaderGroupAngularComp } from 'ag-grid-angular';
import type { IHeaderGroupParams } from 'ag-grid-community';

interface UngroupHeaderParams extends IHeaderGroupParams {
  ungroup: (groupId: string) => void;
}

@Component({
  selector: 'app-ungroup-header',
  host: {
    '[attr.data-column-group-target]': 'targetGroup()',
    '[attr.data-column-group-part]': 'targetPart()',
  },
  template: `
    <span>{{ label() }}</span>
    <button
      type="button"
      [attr.aria-label]="'Ungroup ' + label()"
      (pointerdown)="$event.stopPropagation()"
      (mousedown)="$event.stopPropagation()"
      (keydown)="$event.stopPropagation()"
      (click)="ungroup($event)"
    >
      Ungroup
    </button>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 0;
    }
    span {
      overflow: hidden;
      text-overflow: ellipsis;
    }
    button {
      flex-shrink: 0;
      min-height: 28px;
      padding: 2px 8px;
      border: 1px solid #17675b;
      border-radius: 4px;
      background: white;
      color: #17675b;
      cursor: pointer;
      font: inherit;
    }
    button:focus-visible {
      outline: 2px solid #17675b;
      outline-offset: 2px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UngroupHeader implements IInnerHeaderGroupAngularComp {
  protected readonly label = signal('');
  protected readonly targetGroup = signal<string | null>(null);
  protected readonly targetPart = signal<number | null>(null);
  private params?: UngroupHeaderParams;

  agInit(params: UngroupHeaderParams): void {
    this.refresh(params);
  }

  refresh(params: UngroupHeaderParams): boolean {
    this.params = params;
    this.label.set(params.displayName);
    this.targetGroup.set(params.columnGroup.getGroupId());
    this.targetPart.set(params.columnGroup.getPartId());
    return true;
  }

  protected ungroup(event: MouseEvent): void {
    event.stopPropagation();
    if (this.params) this.params.ungroup(this.params.columnGroup.getGroupId());
  }
}
