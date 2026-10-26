import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  type WritableSignal,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { createEditSession } from '@cells';
import { bomInboundRows } from './data/bom-inbound-rows';
import { outboundRows } from './data/outbound-rows';
import { LAB_USERS, LabUser } from './lab-user';
import { TableTab } from './table-tab';
import { rowId, TreeTablePersistence } from './tree-table-persistence';
import type { TableType, ViewState } from './tree-table.model';
import { resolveView } from './views';

/**
 * Three tree tables in tabs, to check which columns each view shows and that the user's column
 * choices are saved per user, table, mode and sub-mode.
 */
@Component({
  selector: 'app-tree-table-lab',
  imports: [MatButtonToggleModule, MatTabsModule, TableTab],
  template: `
    <main class="page">
      <header class="header">
        <div>
          <h1>Tree table lab</h1>
          <p class="hint">
            Switch mode and sub-mode, then hide or show columns from the Columns panel on the grid's
            right edge. Each view keeps its own choice per user.
          </p>
        </div>
        <div class="user">
          <span id="lab-user-label">Signed in as</span>
          <mat-button-toggle-group
            hideSingleSelectionIndicator
            aria-labelledby="lab-user-label"
            [value]="user.id()"
            (change)="user.id.set($event.value)"
          >
            @for (id of users; track id) {
              <mat-button-toggle [value]="id">{{ id }}</mat-button-toggle>
            }
          </mat-button-toggle-group>
        </div>
      </header>

      <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
        @for (tab of tabs; track tab.table) {
          <mat-tab [label]="tab.label">
            <ng-template matTabContent>
              <app-table-tab
                [table]="tab.table"
                [session]="tab.session"
                [view]="views[tab.table]()"
                (viewChange)="views[tab.table].set($event)"
              />
            </ng-template>
          </mat-tab>
        }
      </mat-tab-group>
    </main>
  `,
  styles: `
    .page {
      display: grid;
      gap: 8px;
      padding: 24px;
    }
    .header {
      display: flex;
      flex-wrap: wrap;
      align-items: start;
      justify-content: space-between;
      gap: 16px;
    }
    h1 {
      margin: 0;
    }
    .hint {
      margin: 4px 0 0;
      max-width: 720px;
    }
    .user {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeTableLab {
  protected readonly user = inject(LabUser);

  // Sessions live on the page, so edits survive switching tabs. BOM and inbound share one: the
  // same rows, shown through different columns.
  private readonly bomInbound = createEditSession(new TreeTablePersistence(bomInboundRows), rowId);
  private readonly outbound = createEditSession(new TreeTablePersistence(outboundRows), rowId);

  /** Each table's view, kept while its tab is closed. */
  protected readonly views: Record<TableType, WritableSignal<ViewState | undefined>> = {
    bom: signal(undefined),
    inbound: signal(resolveView('inbound')),
    outbound: signal(resolveView('outbound')),
  };

  protected readonly users = LAB_USERS;
  protected readonly tabs = [
    { table: 'bom', label: 'BOM', session: this.bomInbound },
    { table: 'inbound', label: 'Inbound', session: this.bomInbound },
    { table: 'outbound', label: 'Outbound', session: this.outbound },
  ] as const;

  constructor() {
    void this.bomInbound.run({ method: 'load' });
    void this.outbound.run({ method: 'load' });
  }
}
