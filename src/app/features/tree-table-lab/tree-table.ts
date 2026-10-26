import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  themeQuartz,
  type ColumnEventType,
  type GridApi,
  type SideBarDef,
} from 'ag-grid-community';
import { cellGridOptions, type EditSession } from '@cells';
import { registerDemoGrid } from '../../shared/ag-grid/grid-registration';
import { ColumnLayoutService } from './column-layout.service';
import {
  buildColumnState,
  columnsByTable,
  layoutKey,
  savedColumns,
  toolPanelLayout,
} from './column-layout';
import { LabUser } from './lab-user';
import type { TreeTablePersistence } from './tree-table-persistence';
import type { RowData, TableType, ViewState } from './tree-table.model';
import { resolveView } from './views';

registerDemoGrid();

const theme = themeQuartz.withParams({ accentColor: '#17675b', fontSize: 13 });

/** Changes the user makes; everything else is our own code or the grid setting itself up. */
const USER_SOURCES = new Set<ColumnEventType>([
  'toolPanelUi',
  'toolPanelDragAndDrop',
  'uiColumnMoved',
  'uiColumnDragged',
  'uiColumnResized',
  'columnMenu',
  'contextMenu',
]);

const sideBar: SideBarDef = {
  toolPanels: [
    {
      id: 'columns',
      labelDefault: 'Columns',
      labelKey: 'columns',
      iconKey: 'columns',
      toolPanel: 'agColumnsToolPanel',
      toolPanelParams: {
        suppressRowGroups: true,
        suppressValues: true,
        suppressPivots: true,
        suppressPivotMode: true,
      },
    },
  ],
};

export interface VisibleColumn {
  readonly colId: string;
  readonly group: string;
  readonly header: string;
}

interface Applied {
  readonly key: string;
  readonly view: ViewState | undefined;
}

/**
 * One tree table. Its column defs never change: a view switch only applies column state, so the
 * grid is never rebuilt and filters, sorting and selection survive it.
 */
@Component({
  selector: 'app-tree-table',
  imports: [AgGridAngular],
  template: `<ag-grid-angular class="grid" [gridOptions]="options()" />`,
  styles: `
    :host {
      display: block;
    }
    .grid {
      display: block;
      height: 540px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TreeTable {
  private readonly layouts = inject(ColumnLayoutService);
  private readonly user = inject(LabUser);

  readonly tableType = input.required<TableType>();
  readonly session = input.required<EditSession<RowData, TreeTablePersistence>>();
  /** Ignored for a fixed table (BOM). */
  readonly view = input<Partial<ViewState>>();
  readonly visibleColumnsChange = output<readonly VisibleColumn[]>();
  readonly layoutKeyChange = output<string>();

  protected readonly resolvedView = computed(() => resolveView(this.tableType(), this.view()));
  protected readonly options = computed(() =>
    cellGridOptions(this.session(), {
      columnDefs: columnsByTable(untracked(this.tableType)),
      theme,
      rowHeight: 36,
      treeData: true,
      getDataPath: (row) => [...row.path],
      groupDefaultExpanded: -1,
      autoGroupColumnDef: { headerName: 'Part', field: 'partName', minWidth: 260, pinned: 'left' },
      sideBar,
      maintainColumnOrder: true,
      onGridReady: ({ api }) => {
        api.setGridAriaProperty('label', `${untracked(this.tableType)} table`);
        this.api = api;
        this.show(untracked(this.resolvedView), untracked(this.user.id));
      },
      onGridPreDestroyed: () => (this.api = undefined),
      // The tool panel is built lazily; give it this view's layout once it opens.
      onToolPanelVisibleChanged: () => this.syncToolPanel(),
      onDisplayedColumnsChanged: () => this.emitVisible(),
      onColumnVisible: ({ source }) => this.onUserChange(source),
      onColumnMoved: ({ source, finished }) => finished && this.onUserChange(source),
      onColumnResized: ({ source, finished }) => finished && this.onUserChange(source),
    }),
  );

  private api?: GridApi<RowData>;
  /** True while our own code changes columns, so those changes are not saved. */
  private applying = false;
  /** The view whose layout the grid shows now; user changes are saved under its key. */
  private applied: Applied | null = null;
  private loadedUser: string | null = null;
  private loadingUser: string | null = null;

  constructor() {
    effect(() => {
      const view = this.resolvedView();
      const user = this.user.id();
      untracked(() => this.show(view, user));
    });
  }

  /** "Reset to default" for the current view. */
  resetLayout(): void {
    const key = layoutKey(this.tableType(), this.resolvedView());
    this.layouts.reset(key).subscribe(() => this.applyLayout(this.resolvedView()));
  }

  /** Applies the view's layout, loading the user's saved layouts first when needed. */
  private show(view: ViewState | undefined, user: string): void {
    if (!this.api) return;
    if (this.loadedUser === user) return this.applyLayout(view);
    if (this.loadingUser === user) return;
    this.loadingUser = user;
    this.layouts.loadAll(this.tableType()).subscribe(() => {
      if (this.user.id() !== user) return;
      this.loadedUser = user;
      this.loadingUser = null;
      this.applyLayout(this.resolvedView());
    });
  }

  private applyLayout(view: ViewState | undefined): void {
    const api = this.api;
    if (!api) return;
    const table = this.tableType();
    const key = layoutKey(table, view);
    const saved = this.layouts.get(key);

    this.applying = true;
    api.applyColumnState({ state: buildColumnState(table, view, saved), applyOrder: true });
    this.applied = { key, view };
    this.syncToolPanel();
    this.applying = false;

    // The user has nothing saved for this view yet: store what they see now.
    if (!saved) this.layouts.save(key, savedColumns(table, view, api.getColumnState()));
    this.layoutKeyChange.emit(key);
    this.emitVisible();
  }

  private syncToolPanel(): void {
    this.api
      ?.getToolPanelInstance('columns')
      ?.setColumnLayout(toolPanelLayout(this.tableType(), this.applied?.view));
  }

  /** Saves hide, width and order of the in-scope columns, under the view shown now. */
  private onUserChange(source: ColumnEventType): void {
    const api = this.api;
    const applied = this.applied;
    if (!api || !applied || this.applying || !USER_SOURCES.has(source)) return;
    this.layouts.queueSave(
      applied.key,
      savedColumns(this.tableType(), applied.view, api.getColumnState()),
    );
  }

  private emitVisible(): void {
    const columns = this.api?.getAllDisplayedColumns() ?? [];
    this.visibleColumnsChange.emit(
      columns
        // Leave out the tree's own Part column.
        .filter((column) => !column.getColId().startsWith('ag-Grid-'))
        .map((column) => ({
          colId: column.getColId(),
          group: column.getParent()?.getColGroupDef()?.headerName ?? '',
          header: column.getColDef().headerName ?? column.getColId(),
        })),
    );
  }
}
