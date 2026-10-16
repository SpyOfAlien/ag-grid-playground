import { ChangeDetectionStrategy, Component, signal, ViewEncapsulation } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  themeQuartz,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
} from 'ag-grid-community';
import { createEquipmentColumns } from './equipment-columns';
import { EQUIPMENT_GROUPS, EQUIPMENT_ROWS, type EquipmentRow } from './equipment-data';

@Component({
  selector: 'app-equipment-column-groups',
  imports: [AgGridAngular],
  template: `
    <main class="equipment-demo">
      <h1 class="equipment-sr-only">Hospital equipment</h1>
      <div class="equipment-toolbar" role="toolbar" aria-label="Column groups">
        <button type="button" class="equipment-button" (click)="setGroupsExpanded(true)">
          Expand all
        </button>
        <button type="button" class="equipment-button" (click)="setGroupsExpanded(false)">
          Collapse all
        </button>
      </div>
      <ag-grid-angular
        class="equipment-grid"
        [modules]="modules"
        [gridOptions]="options"
        [rowData]="rowData"
        (gridReady)="onGridReady($event)"
      />
      <p class="equipment-sr-only" role="status">{{ message() }}</p>
    </main>
  `,
  // Order matters: group header rules override the base table rules.
  styleUrls: [
    './equipment-column-groups.css',
    './equipment-table.css',
    './equipment-group-header.css',
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class EquipmentColumnGroups {
  protected readonly message = signal('');

  private gridApi: GridApi<EquipmentRow> | undefined;
  protected readonly modules = [AllCommunityModule];
  protected readonly rowData = EQUIPMENT_ROWS;
  protected readonly options: GridOptions<EquipmentRow> = {
    columnDefs: createEquipmentColumns(),
    defaultColDef: {
      minWidth: 90,
      sortable: true,
      resizable: true,
      filter: 'agTextColumnFilter',
      floatingFilter: true,
      suppressHeaderMenuButton: true,
      wrapHeaderText: true,
      suppressMovable: true,
    },
    // Values follow the tokens in docs/equipment-table-design-spec.md.
    theme: themeQuartz.withParams({
      accentColor: '#b93815',
      foregroundColor: '#181d27',
      backgroundColor: '#ffffff',
      headerBackgroundColor: '#ffffff',
      headerTextColor: '#414651',
      borderColor: '#e9eaeb',
      rowBorder: false,
      columnBorder: false,
      headerColumnBorder: { color: '#e9eaeb' },
      headerColumnBorderHeight: '100%',
      headerRowBorder: false,
      wrapperBorderRadius: 0,
      fontFamily: ['Inter', 'sans-serif'],
      fontSize: 14,
      headerFontSize: 14,
      headerFontWeight: 500,
      cellHorizontalPadding: 12,
      iconSize: 16,
      inputBorder: { color: '#e9eaeb' },
      inputBorderRadius: 8,
      inputFocusBorder: { color: '#b93815' },
      browserColorScheme: 'light',
    }),
    rowHeight: 44,
    headerHeight: 44,
    groupHeaderHeight: 36,
    floatingFiltersHeight: 44,
    animateRows: false,
    hidePaddedHeaderRows: true,
    // Keep offscreen group headers in the accessibility tree on narrow screens.
    suppressColumnVirtualisation: true,
    ensureDomOrder: true,
    getRowId: ({ data }) => String(data.id),
    // Group resize handles are created from the currently displayed children.
    // Recreate them when fixed-width rails are swapped for resizable columns.
    onColumnGroupOpened: ({ api }) => api.refreshHeader(),
  };

  protected onGridReady(event: GridReadyEvent<EquipmentRow>): void {
    this.gridApi = event.api;
    event.api.setGridAriaProperty('label', 'Hospital equipment');
  }

  protected setGroupsExpanded(open: boolean): void {
    this.gridApi?.setColumnGroupState(EQUIPMENT_GROUPS.map(({ id }) => ({ groupId: id, open })));
    this.message.set(open ? 'All column groups expanded.' : 'All column groups collapsed.');
  }
}
