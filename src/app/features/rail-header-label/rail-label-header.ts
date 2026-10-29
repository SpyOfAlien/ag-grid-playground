import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import type { IHeaderAngularComp } from 'ag-grid-angular';
import type { IHeaderParams } from 'ag-grid-community';
import type { SignalRow } from './signal.model';

export interface RailLabelHeaderParams extends IHeaderParams<SignalRow> {
  /** Total changed cells in the group, shown in the badge. */
  changeCount: number;
}

/**
 * Header of a collapsed group's rail column, and the whole rail: the change badge, then the
 * rotated group name, on the rail's colour, reaching from the header down past the bottom of the
 * table (cut off there by the grid). It lives in the header, which stays put while rows scroll,
 * so the name does too, with nothing to keep in step. The one thing it can't do on its own is
 * stay under the pinned columns when scrolled sideways: rail-header-label-rails.css clips the
 * header at the pinned edge for that.
 *
 * With no changes the badge is hidden but keeps its space, so names start at the same height on
 * every rail. The name is the whole name, read bottom to top: one longer than the table is cut
 * off at its bottom.
 */
@Component({
  selector: 'app-rail-label-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class:
      'flex h-[calc(100%+100vh)] w-full flex-col items-center gap-2 overflow-hidden pt-2 ' +
      'bg-(--group-bg) shadow-[inset_1px_0_0_var(--group-divider),inset_-1px_0_0_var(--group-divider)]',
    '[attr.title]': 'label()',
  },
  template: `
    <span
      class="h-5 min-w-5 shrink-0 rounded bg-(--signal-badge-bg) px-1 text-center text-xs leading-5 font-semibold text-(--signal-badge-fg)"
      [class.invisible]="changeCount() === 0"
      aria-hidden="true"
      >{{ changeCount() }}</span
    >
    <span
      class="shrink-0 rotate-180 text-sm leading-5 font-medium whitespace-nowrap [writing-mode:vertical-rl]"
      >{{ label() }}</span
    >
  `,
})
export class RailLabelHeader implements IHeaderAngularComp {
  protected readonly label = signal('');
  protected readonly changeCount = signal(0);

  agInit(params: RailLabelHeaderParams): void {
    this.refresh(params);
  }

  refresh(params: RailLabelHeaderParams): boolean {
    this.label.set(params.displayName);
    this.changeCount.set(params.changeCount);
    return true;
  }
}
