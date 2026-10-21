import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  themeQuartz,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
} from 'ag-grid-community';
import { buildEquipmentColumnDefs } from './equipment-backend-columns';
import { EQUIPMENT_COLUMN_PAYLOAD, EQUIPMENT_ROWS, type EquipmentRow } from './equipment-data';

const CHANGE_COUNT = EQUIPMENT_ROWS.filter((row) => row.changed).length;

@Component({
  selector: 'app-equipment-column-groups',
  imports: [AgGridAngular],
  template: `
    <main class="equipment-demo">
      <header class="equipment-toolbar">
        <h1 class="equipment-title">Hospital equipment</h1>
        <div class="equipment-actions" role="toolbar" aria-label="Column groups">
          <button type="button" class="equipment-button" (click)="setGroupsExpanded(true)">
            Expand all
          </button>
          <button type="button" class="equipment-button" (click)="setGroupsExpanded(false)">
            Collapse all
          </button>
        </div>
      </header>
      <!-- Header row above the filter row, so rail headers can paint the filter-row slot.
           Pinned filter cells go above both, so a rail scrolled under them stays hidden. -->
      <ag-grid-angular
        class="equipment-grid [&_.ag-header-row-column]:z-3 [&_.ag-header-row-filter_:is(.ag-grid-pinned-left-cells,.ag-grid-pinned-right-cells)]:z-4"
        [modules]="modules"
        [gridOptions]="options"
        [rowData]="rowData"
        (gridReady)="onGridReady($event)"
      />
    </main>
  `,
  // Group headers and rails are styled with Tailwind classes (equipment-group-classes.ts).
  styleUrls: ['./equipment-column-groups.css', './equipment-table.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
})
export class EquipmentColumnGroups {
  private readonly liveAnnouncer = inject(LiveAnnouncer);

  private gridApi: GridApi<EquipmentRow> | undefined;
  protected readonly modules = [AllCommunityModule];
  protected readonly rowData = EQUIPMENT_ROWS;
  protected readonly options: GridOptions<EquipmentRow> = {
    columnDefs: buildEquipmentColumnDefs(
      EQUIPMENT_COLUMN_PAYLOAD.groups,
      EQUIPMENT_COLUMN_PAYLOAD.columns,
      { changeCountFor: () => CHANGE_COUNT },
    ),
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
    this.gridApi?.setColumnGroupState(
      EQUIPMENT_COLUMN_PAYLOAD.groups.map(({ code }) => ({ groupId: code, open })),
    );
    void this.liveAnnouncer.announce(
      open ? 'All column groups expanded.' : 'All column groups collapsed.',
    );
  }
}
