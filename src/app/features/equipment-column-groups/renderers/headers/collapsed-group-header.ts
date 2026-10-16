import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { IHeaderAngularComp } from 'ag-grid-angular';
import type { IHeaderParams } from 'ag-grid-community';

export interface CollapsedGroupHeaderParams extends IHeaderParams<unknown> {
  /** Number shown in the red badge above the group name. */
  changeCount: number;
}

/**
 * Column header shown in place of a collapsed group: change count plus the rotated
 * group name. Used as the headerComponent of the group's rail column.
 */
@Component({
  selector: 'app-collapsed-group-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex h-max w-full flex-col items-center gap-2 py-1.5' },
  template: `
    <span
      class="h-5 min-w-5 rounded bg-[#f04438] text-center text-xs leading-5 font-semibold text-white"
      [attr.aria-label]="changeCount() + ' changes'"
      >{{ changeCount() }}</span
    >
    <span
      class="rotate-180 text-sm leading-5 font-medium whitespace-nowrap [writing-mode:vertical-rl]"
      >{{ label() }}</span
    >
  `,
})
export class CollapsedGroupHeader implements IHeaderAngularComp {
  protected readonly label = signal('');
  protected readonly changeCount = signal(0);

  agInit(params: CollapsedGroupHeaderParams): void {
    this.refresh(params);
  }

  refresh(params: CollapsedGroupHeaderParams): boolean {
    this.label.set(params.displayName);
    this.changeCount.set(params.changeCount);
    return true;
  }
}
