import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import type { EditSession } from '@cells';
import { LabUser } from './lab-user';
import { LayoutInspector } from './layout-inspector';
import { TreeTable, type VisibleColumn } from './tree-table';
import type { TreeTablePersistence } from './tree-table-persistence';
import type { RowData, TableType, ViewState } from './tree-table.model';
import { ViewSwitcher } from './view-switcher';
import { hasModes } from './views';

/** One tab: the view buttons, the table, what it shows and what the fake API saved. */
@Component({
  selector: 'app-table-tab',
  imports: [MatButtonModule, LayoutInspector, TreeTable, ViewSwitcher],
  template: `
    <div class="toolbar">
      @if (modes()) {
        <app-view-switcher [table]="table()" [(view)]="view" />
      } @else {
        <p class="fixed">BOM has no modes: it always shows the same clusters.</p>
      }
      <button mat-stroked-button type="button" (click)="grid.resetLayout()">
        Reset this view to default
      </button>
    </div>

    <div class="body">
      <div class="main">
        <app-tree-table
          #grid
          [tableType]="table()"
          [session]="session()"
          [view]="view()"
          (visibleColumnsChange)="visible.set($event)"
          (layoutKeyChange)="layoutKey.set($event)"
        />
        <section class="visible" aria-labelledby="visible-title-{{ table() }}">
          <h2 id="visible-title-{{ table() }}">Visible columns ({{ visible().length }})</h2>
          <ul aria-live="polite">
            @for (column of visible(); track column.colId) {
              <li>
                <span class="group">{{ column.group }}</span> {{ column.header }}
              </li>
            }
          </ul>
        </section>
      </div>
      <app-layout-inspector [user]="user.id()" [layoutKey]="layoutKey()" />
    </div>
  `,
  styles: `
    :host {
      display: grid;
      gap: 16px;
      padding-top: 16px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      justify-content: space-between;
      gap: 16px;
    }
    .fixed {
      margin: 0;
    }
    .body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 340px;
      gap: 16px;
    }
    .main {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    h2 {
      margin: 0 0 6px;
      font-size: 14px;
    }
    .visible ul {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .visible li {
      padding: 2px 8px;
      border-radius: 12px;
      background: #e3eeea;
      font-size: 12px;
    }
    .group {
      color: #3f4b47;
    }
    @media (max-width: 1100px) {
      .body {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableTab {
  protected readonly user = inject(LabUser);

  readonly table = input.required<TableType>();
  readonly session = input.required<EditSession<RowData, TreeTablePersistence>>();
  readonly view = model<ViewState | undefined>();

  protected readonly visible = signal<readonly VisibleColumn[]>([]);
  protected readonly layoutKey = signal('');
  protected readonly modes = computed(() => hasModes(this.table()));
}
