import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  inject,
  signal,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
} from 'ag-grid-community';
import { buildEquipmentColumnDefs } from './equipment-backend-columns';
import { EQUIPMENT_COLUMN_PAYLOAD, EQUIPMENT_ROWS, type EquipmentRow } from './equipment-data';
import { EquipmentToolbar } from './equipment-toolbar';

const CHANGE_COUNT = EQUIPMENT_ROWS.filter((row) => row.changed).length;

const DEFAULT_COL_DEF: ColDef<EquipmentRow> = {
  minWidth: 90,
  sortable: true,
  resizable: true,
  filter: 'agTextColumnFilter',
  floatingFilter: true,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  suppressMovable: true,
};

/** Row added by Add Row: every text field empty and no revision history. */
function blankEquipmentRow(id: number): EquipmentRow {
  const blank = Object.fromEntries(
    Object.entries(EQUIPMENT_ROWS[0]).map(([key, value]) => [
      key,
      typeof value === 'string' ? '' : value,
    ]),
  ) as unknown as EquipmentRow;
  return { ...blank, id, bookings: 0, changed: false, previousWard: null, previousWardCode: null };
}

@Component({
  selector: 'app-equipment-column-groups',
  imports: [AgGridAngular, EquipmentToolbar],
  template: `
    <main #demo class="equipment-demo">
      <header class="equipment-toolbar">
        <h1 class="equipment-title">Hospital equipment</h1>
        <app-equipment-toolbar
          [groupsExpanded]="groupsExpanded()"
          [fullScreen]="fullScreen()"
          [filtersHidden]="filtersHidden()"
          (filtersHiddenChange)="setFiltersHidden($event)"
          (groupsToggle)="setGroupsExpanded(!groupsExpanded())"
          (fullScreenToggle)="toggleFullScreen()"
          (rowAdd)="addRow()"
        />
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
  host: { '(document:fullscreenchange)': 'syncFullScreen()' },
})
export class EquipmentColumnGroups {
  private readonly liveAnnouncer = inject(LiveAnnouncer);
  private readonly document = inject(DOCUMENT);

  private readonly demo = viewChild.required<ElementRef<HTMLElement>>('demo');

  protected readonly groupsExpanded = signal(false);
  protected readonly filtersHidden = signal(false);
  protected readonly fullScreen = signal(false);

  private gridApi: GridApi<EquipmentRow> | undefined;
  private nextRowId = Math.max(...EQUIPMENT_ROWS.map(({ id }) => id)) + 1;
  protected readonly modules = [AllCommunityModule];
  protected readonly rowData = EQUIPMENT_ROWS;
  protected readonly options: GridOptions<EquipmentRow> = {
    columnDefs: buildEquipmentColumnDefs(
      EQUIPMENT_COLUMN_PAYLOAD.groups,
      EQUIPMENT_COLUMN_PAYLOAD.columns,
      { changeCountFor: () => CHANGE_COUNT },
    ),
    defaultColDef: DEFAULT_COL_DEF,
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
    onColumnGroupOpened: ({ api }) => {
      api.refreshHeader();
      this.syncGroupsExpanded();
    },
  };

  protected onGridReady(event: GridReadyEvent<EquipmentRow>): void {
    this.gridApi = event.api;
    event.api.setGridAriaProperty('label', 'Hospital equipment');
    this.syncGroupsExpanded();
  }

  protected setGroupsExpanded(open: boolean): void {
    this.gridApi?.setColumnGroupState(
      EQUIPMENT_COLUMN_PAYLOAD.groups.map(({ code }) => ({ groupId: code, open })),
    );
    this.syncGroupsExpanded();
    void this.liveAnnouncer.announce(
      open ? 'All column groups expanded.' : 'All column groups collapsed.',
    );
  }

  /** Hides the filter row only; filters already typed keep applying. */
  protected setFiltersHidden(hidden: boolean): void {
    this.filtersHidden.set(hidden);
    this.gridApi?.setGridOption('defaultColDef', { ...DEFAULT_COL_DEF, floatingFilter: !hidden });
  }

  protected toggleFullScreen(): void {
    if (this.document.fullscreenElement) {
      void this.document.exitFullscreen();
      return;
    }
    this.demo()
      .nativeElement.requestFullscreen()
      .catch(() => this.liveAnnouncer.announce('Full screen is not available.'));
  }

  protected syncFullScreen(): void {
    this.fullScreen.set(this.document.fullscreenElement === this.demo().nativeElement);
  }

  protected addRow(): void {
    const api = this.gridApi;
    if (!api) {
      return;
    }
    const row = blankEquipmentRow(this.nextRowId++);
    const [node] = api.applyTransaction({ add: [row] })?.add ?? [];
    if (node?.rowIndex != null) {
      api.ensureIndexVisible(node.rowIndex, 'bottom');
    }
    void this.liveAnnouncer.announce(`Row ${row.id} added.`);
  }

  // Checks the payload groups only: getColumnGroupState() also lists AG Grid's padding groups.
  private syncGroupsExpanded(): void {
    const api = this.gridApi;
    if (!api) {
      return;
    }
    this.groupsExpanded.set(
      EQUIPMENT_COLUMN_PAYLOAD.groups.every(
        ({ code }) => api.getProvidedColumnGroup(code)?.isExpanded() ?? true,
      ),
    );
  }
}
