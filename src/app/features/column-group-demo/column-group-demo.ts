import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AgGridAngular } from 'ag-grid-angular';
import {
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
  themeQuartz,
} from 'ag-grid-community';
import { registerDemoGrid } from '../../shared/ag-grid/grid-registration';
import { COLUMN_GROUP_COLUMNS, COLUMN_GROUP_ROWS, type ColumnGroupRow } from './column-group-data';
import { UngroupHeader } from './ungroup-header';
import { ColumnDragGrouping } from './column-drag-grouping';
import {
  canCombineGroups,
  canGroupColumn,
  columnId,
  columnParent,
  combineColumnGroups,
  detachColumn,
  findColumnDefinition,
  flattenColumns,
  groupColumns,
  orderColumns,
  removeColumnGroups,
  type ColumnDefinition,
  type ColumnDropTarget,
} from './column-groups';

registerDemoGrid();

@Component({
  selector: 'app-column-group-demo',
  imports: [
    AgGridAngular,
    ColumnDragGrouping,
    MatCheckboxModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './column-group-demo.html',
  styleUrl: './column-group-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColumnGroupDemo {
  private readonly initialColumns = COLUMN_GROUP_COLUMNS.map((column) => ({ ...column }));
  private readonly groupedColumns = signal<ColumnDefinition<ColumnGroupRow>[]>(this.initialColumns);
  readonly middleMouseGrouping = signal(false);
  readonly message = signal('Drag a header while holding Shift to group columns.');

  readonly groupChoices = computed(() => {
    const collect = (
      columns: ColumnDefinition<ColumnGroupRow>[],
    ): { id: string; label: string }[] =>
      columns.flatMap((column) =>
        'children' in column
          ? [
              ...(column.groupId
                ? [{ id: column.groupId, label: column.headerName ?? column.groupId }]
                : []),
              ...collect(column.children),
            ]
          : [],
      );
    return collect(this.groupedColumns());
  });
  readonly canGroupColumns = (source: string, target: ColumnDropTarget): boolean =>
    canGroupColumn(this.groupedColumns(), source, target);
  readonly canCombineColumnGroups = (source: string, target: string): boolean =>
    canCombineGroups(this.groupedColumns(), source, target);
  readonly isSourceGroup = (
    source: string,
    target: Extract<ColumnDropTarget, { kind: 'group' }>,
  ): boolean => {
    const leaves = this.gridApi?.getColumnGroup(target.id, target.partId)?.getLeafColumns();
    return leaves?.length === 1 && leaves[0].getColId() === source;
  };

  readonly groupingChoices = this.initialColumns.map((column) => ({
    id: columnId(column),
    label: column.headerName ?? columnId(column),
  }));
  private gridApi?: GridApi<ColumnGroupRow>;

  readonly options: GridOptions<ColumnGroupRow> = {
    columnDefs: this.initialColumns,
    rowData: COLUMN_GROUP_ROWS,
    defaultColDef: {
      sortable: true,

      resizable: true,
      editable: false,
      suppressHeaderMenuButton: true,
    },
    defaultColGroupDef: {
      marryChildren: true,
      headerGroupComponentParams: {
        innerHeaderGroupComponent: UngroupHeader,
        innerHeaderGroupComponentParams: {
          ungroup: (groupId: string) => this.ungroupColumns(groupId),
        },
      },
    },
    suppressDragLeaveHidesColumns: true,
    getRowId: ({ data }) => data.id,
    loading: false,
    rowHeight: 40,
    headerHeight: 44,
    animateRows: false,
    theme: themeQuartz.withParams({
      accentColor: '#17675b',
      cellHorizontalPadding: 24,
      fontSize: 13,
    }),
  };

  onGridReady(event: GridReadyEvent<ColumnGroupRow>): void {
    this.gridApi = event.api;
    event.api.setGridAriaProperty('label', 'Column grouping demo');
  }

  setColumnMovementPaused(paused: boolean): void {
    this.gridApi?.setGridOption('suppressMoveWhenColumnDragging', paused);
  }

  groupColumns(source: string, target: string | ColumnDropTarget): void {
    if (!this.gridApi) return;
    this.syncColumnOrder();
    const next = groupColumns(this.groupedColumns(), source, target);
    if (next === this.groupedColumns()) {
      this.message.set('Choose different columns or a different group.');
      return;
    }
    this.applyColumns(next);
    this.message.set(
      'Column grouped. Drop on a group header to join it, or on a child column to create a subgroup.',
    );
  }

  combineGroups(source: string, target: string): void {
    if (!this.gridApi) return;
    this.syncColumnOrder();
    const next = combineColumnGroups(this.groupedColumns(), source, target);
    if (next === this.groupedColumns()) {
      this.message.set('Choose two different groups that do not contain each other.');
      return;
    }
    this.applyColumns(next);
    this.message.set(
      'Groups combined under a new parent. Use Ungroup on the parent to separate them.',
    );
  }

  onColumnDrop(drop: {
    source: string;
    target: ColumnDropTarget | null;
    placement: { columnId: string; after: boolean } | null;
  }): void {
    if (!this.gridApi) return;
    const parent = columnParent(this.groupedColumns(), drop.source);
    if (!parent) return;
    if (
      drop.target?.kind === 'column' &&
      (drop.target.id === drop.source ||
        columnParent(this.groupedColumns(), drop.target.id)?.groupId === parent.groupId)
    )
      return;
    if (drop.target?.kind === 'group') {
      const group = findColumnDefinition(this.groupedColumns(), drop.target);
      if (group && flattenColumns([group]).some((column) => columnId(column) === drop.source))
        return;
    }
    this.syncColumnOrder();
    const order = this.gridApi.getColumnState().map((column) => column.colId);
    if (drop.placement) {
      const { columnId: targetId, after } = drop.placement;
      const targetRoot = this.groupedColumns().find((column) =>
        flattenColumns([column]).some((leaf) => columnId(leaf) === targetId),
      );
      const siblings = targetRoot
        ? flattenColumns([targetRoot])
            .map(columnId)
            .filter((id) => id !== drop.source)
        : [];
      const anchor = after ? siblings.at(-1) : siblings[0];
      if (anchor) {
        order.splice(order.indexOf(drop.source), 1);
        order.splice(order.indexOf(anchor) + (after ? 1 : 0), 0, drop.source);
      }
    }
    this.applyColumns(detachColumn(this.groupedColumns(), drop.source, order));
    this.message.set('Column moved out of its group.');
  }

  ungroupColumns(groupId?: string): void {
    if (!this.gridApi) return;
    this.syncColumnOrder();
    const group = groupId
      ? findColumnDefinition(this.groupedColumns(), { kind: 'group', id: groupId })
      : undefined;
    const firstChild = group ? columnId(flattenColumns([group])[0]) : undefined;
    this.applyColumns(removeColumnGroups(this.groupedColumns(), groupId));
    if (firstChild) this.gridApi.setFocusedHeader(firstChild);
    this.message.set('Column groups removed.');
  }

  private syncColumnOrder(): void {
    if (!this.gridApi) return;
    this.groupedColumns.set(
      orderColumns(
        this.groupedColumns(),
        this.gridApi.getColumnState().map((column) => column.colId),
      ),
    );
  }

  private applyColumns(columns: ColumnDefinition<ColumnGroupRow>[]): void {
    if (!this.gridApi) return;
    const state = this.gridApi.getColumnState();
    this.groupedColumns.set(columns);
    this.gridApi.setGridOption('columnDefs', columns);
    // Preserve widths, sorting, visibility and pinning while using the new group order.
    this.gridApi.applyColumnState({ state });
  }

  resetLayout(): void {
    if (!this.gridApi) return;
    this.applyColumns(this.initialColumns);
    this.gridApi.resetColumnState();
    this.message.set('Column layout reset.');
  }
}
